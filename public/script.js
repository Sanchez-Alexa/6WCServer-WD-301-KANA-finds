const { createApp } = Vue;

createApp({

    data() {
        return {
            restaurants: [],
            page: 1,
            pages: 1,
            total: 0,
            message: "", 

            filters: { name: "", borough: "", cuisine: "", grade: "", maxScore: "" },

            editingId: null,
            form: { name: "", borough: "", cuisine: "", grade: "A", score: 0 },
            formError: "",

            toastText: "",
            toastVisible: false,
            toastTimer: null
        };
    },

    computed: {
        countText() {
            if (this.total === 1) return "1 restaurant";
            return `${this.total.toLocaleString()} restaurants`;
        }
    },

    mounted() {
        this.loadRestaurants(1);
    },

    methods: {

        async loadRestaurants(page = 1) {
            const params = new URLSearchParams();

            if (this.filters.name.trim()) params.append("name", this.filters.name.trim());
            if (this.filters.borough) params.append("borough", this.filters.borough);
            if (this.filters.cuisine) params.append("cuisine", this.filters.cuisine);
            if (this.filters.grade) params.append("grade", this.filters.grade);
            if (this.filters.maxScore !== "" && this.filters.maxScore !== null) {
                params.append("maxScore", this.filters.maxScore);
            }
            params.append("page", page);

            try {
                const response = await fetch(`/api/restaurants?${params}`);
                const data = await response.json();

                if (!response.ok) {
                    this.restaurants = [];
                    this.message = data.error || "Unable to load restaurants.";
                    return;
                }

                this.restaurants = data.restaurants;
                this.page = data.page;
                this.pages = data.pages;
                this.total = data.total;
                this.message = data.restaurants.length === 0
                    ? "No restaurants match your search. Change the search or filters, or add a new restaurant."
                    : "";

            } catch (error) {
                this.restaurants = [];
                this.message = "Cannot reach the server. Check that it is running.";
            }
        },

        gradeClass(grade) {
            return ["A", "B", "C"].includes(grade) ? `grade-${grade}` : "grade-other";
        },

        openAddForm() {
            this.editingId = null;
            this.form = { name: "", borough: "", cuisine: "", grade: "A", score: 0 };
            this.formError = "";
            this.$refs.dialog.showModal();
        },

        openEditForm(restaurant) {
            this.editingId = restaurant.restaurant_id;
            // Fill the form with the current values
            this.form = {
                name: restaurant.name,
                borough: restaurant.borough,
                cuisine: restaurant.cuisine,
                grade: "A",
                score: 0
            };
            this.formError = "";
            this.$refs.dialog.showModal();
        },

        closeForm() {
            this.$refs.dialog.close();
        },

        normalizeCuisine(value) {
            const cuisine = value.trim();
            return cuisine.toLowerCase() === "american" ? "American " : cuisine;
        },


        async saveRestaurant() {
            this.formError = "";

            const data = {
                name: this.form.name.trim(),
                borough: this.form.borough,
                cuisine: this.normalizeCuisine(this.form.cuisine)
            };

            const adding = this.editingId === null;
            let url = "/api/restaurants";
            let method = "POST";

            if (adding) {

                data.grade = this.form.grade;
                data.score = this.form.score;
            } else {
                url = `/api/restaurants/${encodeURIComponent(this.editingId)}`;
                method = "PUT";
            }

            try {
                const response = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                const result = await response.json();

                if (!response.ok) {
                    this.formError = result.error || "Something went wrong. Try again.";
                    return;
                }

                this.closeForm();
                this.showToast(adding ? "Restaurant added." : "Restaurant updated.");
                this.loadRestaurants(this.page);

            } catch (error) {
                this.formError = "Cannot reach the server. Check that it is running.";
            }
        },

        async deleteRestaurant(restaurant) {
            if (!confirm(`Delete ${restaurant.name}? This cannot be undone.`)) {
                return;
            }

            try {
                const response = await fetch(
                    `/api/restaurants/${encodeURIComponent(restaurant.restaurant_id)}`,
                    { method: "DELETE" }
                );
                const result = await response.json();

                if (!response.ok) {
                    this.showToast(result.error || "Unable to delete restaurant.");
                    return;
                }

                this.showToast("Restaurant deleted.");

                const page = this.restaurants.length === 1 && this.page > 1 ? this.page - 1 : this.page;
                this.loadRestaurants(page);

            } catch (error) {
                this.showToast("Cannot reach the server. Check that it is running.");
            }
        },
        showToast(text) {
            this.toastText = text;
            this.toastVisible = true;
            clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => { this.toastVisible = false; }, 2800);
        }
    }

}).mount("#app");