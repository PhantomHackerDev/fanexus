import socket, { Socket } from "socket.io";
import { server } from "./ServerService";
export const io = socket(server);
export const currentSessions: Map<number, Socket[]> = new Map();

const addSocketToUser = (userId: number, connection: Socket) => {
    const existingSockets = currentSessions.get(userId);
    if (existingSockets) {
        existingSockets.push(connection);
    } else {
        currentSessions.set(userId, [connection]);
    }
};

const removeSocketFromUser = (userId: number, connection: Socket) => {
    const existingSockets = currentSessions.get(userId);
    if (existingSockets) {
        existingSockets.splice(
            existingSockets.findIndex(
                existingSocket => existingSocket === connection
            ),
            1
        );
    }
};

io.on("connection", (connection: Socket) => {
    connection.on("add-session", (userId: number) => {
        addSocketToUser(userId, connection);
    });
    connection.on("remove-session", (userId: number) => {
        removeSocketFromUser(userId, connection);
    });
});
