import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import router, { currentUserRef } from "./router";

const app = createApp(App);

app.use(router);
app.provide("currentUser", currentUserRef);
app.mount("#app");
