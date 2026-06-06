import dotenv from "dotenv";
dotenv.config();

// app/httpServer must be imported after dotenv.config() so env vars are available
// eslint-disable-next-line import/first
import { app, httpServer } from "./app";
import { setupWebSocket } from "./websocket/socket";

setupWebSocket(httpServer);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

export { app, httpServer };
