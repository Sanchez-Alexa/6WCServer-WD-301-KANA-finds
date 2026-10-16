const express = require("express");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = 3000;
const client = new MongoClient("mongodb://localhost:27017");

let db;

async function connectDB() {
    await client.connect();
    db = client.db("restaurantDB");
    console.log("Connected to MongoDB!");
}

connectDB();

app.use(express.json());

app.use((req, res, next) => {
    const cookies = (req.headers.cookie || "").split(";").map(c => c.trim());
    const found = cookies.find(c => c.startsWith("visitorId="));
    let visitorId = found ? found.slice("visitorId=".length) : null;

    if (!visitorId || !/^[0-9a-f-]{36}$/.test(visitorId)) {
        visitorId = crypto.randomUUID();
        res.cookie("visitorId", visitorId, {
            httpOnly: true,                   
            sameSite: "lax",
            maxAge: 365 * 24 * 60 * 60 * 1000
        });
    }

    req.visitorId = visitorId;
    next();
});

app.use(express.static("public"));

const BOROUGHS = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"];
const GRADES = ["A", "B", "C"];
const PAGE_SIZE = 20;

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

app.get("/api/restaurants", async (req, res) => {
    try {
        const { name, borough, cuisine, grade, maxScore } = req.query;
        const page = Math.max(parseInt(req.query.page) || 1, 1);

        const pipeline = [];

        const matchStage = {};
        if (name && name.trim()) {
            matchStage.name = { $regex: escapeRegex(name.trim()), $options: "i" };
        }
        if (borough) matchStage.borough = borough;
        if (cuisine) matchStage.cuisine = cuisine;
        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        pipeline.push({ $unwind: "$grades" });

        if (grade || maxScore) {
            const gradeMatch = {};
            if (grade) gradeMatch["grades.grade"] = grade;
            if (maxScore) gradeMatch["grades.score"] = { $lte: Number(maxScore) };
            pipeline.push({ $match: gradeMatch });
        }

        pipeline.push({ $sort: { "grades.date": -1 } });
        pipeline.push({
            $group: {
                _id: "$restaurant_id",
                name: { $first: "$name" },
                borough: { $first: "$borough" },
                cuisine: { $first: "$cuisine" },
                ownerId: { $first: "$ownerId" },
                grade: { $first: "$grades.grade" },
                score: { $first: "$grades.score" }
            }
        });

        pipeline.push({
            $project: {
                _id: 0,
                restaurant_id: "$_id",
                name: 1,
                borough: 1,
                cuisine: 1,
                grade: 1,
                score: 1,
                canModify: { $eq: ["$ownerId", { $literal: req.visitorId }] }
            }
        });

        pipeline.push({ $sort: { name: 1, restaurant_id: 1 } });

        pipeline.push({
            $facet: {
                restaurants: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
                total: [{ $count: "count" }]
            }
        });

        const [result] = await db
            .collection("restaurants")
            .aggregate(pipeline, { allowDiskUse: true })
            .toArray();

        const total = result.total.length ? result.total[0].count : 0;

        res.json({
            restaurants: result.restaurants,
            total,
            page,
            pages: Math.max(Math.ceil(total / PAGE_SIZE), 1)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to retrieve restaurants" });
    }
});

app.post("/api/restaurants", async (req, res) => {
    try {
        const name = (req.body.name || "").trim();
        const borough = req.body.borough;
        const cuisine = req.body.cuisine;
        const grade = req.body.grade;
        const score = Number(req.body.score);

        if (!name) {
            return res.status(400).json({ error: "Name is required." });
        }
        if (!BOROUGHS.includes(borough)) {
            return res.status(400).json({ error: "Please choose a valid borough." });
        }
        if (!cuisine || !cuisine.trim()) {
            return res.status(400).json({ error: "Cuisine is required." });
        }
        if (!GRADES.includes(grade)) {
            return res.status(400).json({ error: "Grade must be A, B or C." });
        }
        if (Number.isNaN(score) || score < 0) {
            return res.status(400).json({ error: "Score must be a number, 0 or higher." });
        }

        const newRestaurant = {
            restaurant_id: Date.now().toString(),
            name,
            borough,
            cuisine,
            address: {},
            ownerId: req.visitorId,
            grades: [{ date: new Date(), grade, score }]
        };

        await db.collection("restaurants").insertOne(newRestaurant);

        res.status(201).json({ message: "Restaurant added.", restaurant_id: newRestaurant.restaurant_id });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to add restaurant." });
    }
});

app.put("/api/restaurants/:id", async (req, res) => {
    try {
        const name = (req.body.name || "").trim();
        const borough = req.body.borough;
        const cuisine = req.body.cuisine;

        if (!name) {
            return res.status(400).json({ error: "Name is required." });
        }
        if (!BOROUGHS.includes(borough)) {
            return res.status(400).json({ error: "Please choose a valid borough." });
        }
        if (!cuisine || !cuisine.trim()) {
            return res.status(400).json({ error: "Cuisine is required." });
        }

        const existing = await db.collection("restaurants").findOne(
            { restaurant_id: req.params.id },
            { projection: { ownerId: 1 } }
        );

        if (!existing) {
            return res.status(404).json({ error: "Restaurant not found." });
        }
        if (existing.ownerId !== req.visitorId) {
            return res.status(403).json({ error: "You can only edit restaurants you added." });
        }

        await db.collection("restaurants").updateOne(
            { restaurant_id: req.params.id, ownerId: req.visitorId },
            { $set: { name, borough, cuisine } }
        );

        res.json({ message: "Restaurant updated." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to update restaurant." });
    }
});

app.delete("/api/restaurants/:id", async (req, res) => {
    try {
        const existing = await db.collection("restaurants").findOne(
            { restaurant_id: req.params.id },
            { projection: { ownerId: 1 } }
        );

        if (!existing) {
            return res.status(404).json({ error: "Restaurant not found." });
        }
        if (existing.ownerId !== req.visitorId) {
            return res.status(403).json({ error: "You can only delete restaurants you added." });
        }

        await db.collection("restaurants").deleteOne({
            restaurant_id: req.params.id,
            ownerId: req.visitorId
        });

        res.json({ message: "Restaurant deleted." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to delete restaurant." });
    }
});

app.post("/api/contact", async (req, res) => {
    try {
        const name = (req.body.name || "").trim();
        const email = (req.body.email || "").trim();
        const message = (req.body.message || "").trim();

        if (!name || name.length > 100) {
            return res.status(400).json({ error: "Please enter your name (up to 100 characters)." });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }
        if (!message || message.length > 2000) {
            return res.status(400).json({ error: "Please write a message (up to 2000 characters)." });
        }

        await db.collection("messages").insertOne({
            name,
            email,
            message,
            createdAt: new Date()
        });

        res.status(201).json({ message: "Message sent." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Unable to send your message. Please try again." });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});