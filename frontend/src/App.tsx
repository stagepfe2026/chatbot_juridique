import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./App.css";

function App() {
  return (
    // Monte le router global pour toute l'application.
    <RouterProvider router={router} />
  );
}

export default App;
