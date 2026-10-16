const { createApp } = Vue;

createApp({

    data() {
        return {
            form: { name: "", email: "", message: "" },
            error: "",
            sending: false,
            sent: false,
            sentName: ""
        };
    },

    methods: {

        validate() {
            if (!this.form.name.trim()) return "Please enter your name.";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())) {
                return "Please enter a valid email address.";
            }
            if (!this.form.message.trim()) return "Please write a message.";
            return "";
        },

        async sendMessage() {
            this.sent = false;
            this.error = this.validate();
            if (this.error) return;

            this.sending = true;

            try {
                const response = await fetch("/api/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: this.form.name.trim(),
                        email: this.form.email.trim(),
                        message: this.form.message.trim()
                    })
                });
                const result = await response.json();

                if (!response.ok) {
                    this.error = result.error || "Something went wrong. Try again.";
                    return;
                }

                this.sentName = this.form.name.trim();
                this.sent = true;
                this.form = { name: "", email: "", message: "" };

            } catch (error) {
                this.error = "Cannot reach the server. Check that it is running.";
            } finally {
                this.sending = false;
            }
        }
    }

}).mount("#app");