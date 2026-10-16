KANA finds

A restaurant guide for the five boroughs of New York. Browse restaurants, see how each one scored on its health inspections, and add your own.

Built with the MEVN stack: MongoDB, Express, Vue and Node.js.

Features

- Search restaurants by name
- Filter by borough, cuisine, grade (A, B, C) and maximum score
- Pagination, 20 restaurants per page
- Add a restaurant with its borough, cuisine, grade and score
- Edit or delete the restaurants you added (other restaurants are view only)
- Contact form that saves messages to the database
- Client-side and server-side validation

Tech stack

| Part | Technology |
|---|---|
| Database | MongoDB (official `mongodb` driver) |
| Backend | Node.js and Express 5 |
| Frontend | Vue 3 (loaded with a script tag, no build step) |

Getting started

Requirements

- [Node.js](https://nodejs.org/)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) running on `localhost:27017`
- [MongoDB Compass](https://www.mongodb.com/products/tools/compass) (optional, for viewing data)

Install

```bash
git clone https://github.com/Sanchez-Alexa/WCServer_Final_Project.git
cd WCServer_Final_Project
npm install
```

Import the data

The app reads from the `restaurants` collection in a database called `restaurantDB`. Import your NYC restaurants dataset into it before starting the server:

```bash
mongoimport --db restaurantDB --collection restaurants --file restaurants.json
```

You can also import the file with the Add Data button in MongoDB Compass. Each restaurant document should have `restaurant_id`, `name`, `borough`, `cuisine`, `address` and a `grades` array (each grade has `date`, `grade` and `score`).

Run

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

Project structure

```
restaurant-explorer/
├── server.js          Express server and REST API
├── package.json
└── public/            Frontend (served by Express)
    ├── index.html         Home
    ├── about.html         About
    ├── restaurants.html   List of restaurants (Vue app)
    ├── contact.html       Contact form (Vue app)
    ├── script.js          Vue code for the restaurants page
    ├── contact.js         Vue code for the contact page
    ├── style.css
    ├── vue.global.prod.js
    └── images/
```

API

| Method | Route | Description |
|---|---|---|
| GET | `/api/restaurants` | List restaurants. Query: `name`, `borough`, `cuisine`, `grade`, `maxScore`, `page` |
| POST | `/api/restaurants` | Add a restaurant. Body: `name`, `borough`, `cuisine`, `grade`, `score` |
| PUT | `/api/restaurants/:id` | Update a restaurant you added. Body: `name`, `borough`, `cuisine` |
| DELETE | `/api/restaurants/:id` | Delete a restaurant you added |
| POST | `/api/contact` | Save a contact message. Body: `name`, `email`, `message` |

How ownership works

There is no login. Each browser gets a random visitor ID stored in an HTTP-only cookie. A restaurant is tagged with the ID of the browser that added it, and only that browser can edit or delete it. Restaurants from the original dataset are view only.

Notes

- The server connects to `mongodb://localhost:27017`. Change the connection string in `server.js` to use another database.
- Contact messages are stored in the `messages` collection.
