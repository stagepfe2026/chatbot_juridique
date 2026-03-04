import axios from "axios";

export const httpClient = axios.create({
  baseURL: "/api", // si vous avez un proxy dev vers backend
  withCredentials: true, // si cookies/session
  timeout: 120_000,
});
