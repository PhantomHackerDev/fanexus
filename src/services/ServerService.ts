import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload";

import { blogRouter } from "@routes/blog";
import { userRouter } from "@routes/users";
import { aliasRouter } from "@routes/alias";
import { blogPostRouter } from "@routes/blogPost";
import { commentsRouter } from "@routes/comments";
import { communityRouter } from "@routes/community";
import { newsFeedRouter } from "@routes/newsFeed";
import { securityGroupRouter } from "@routes/securityGroup";
import { dbFixturesRouter } from "@routes/DbFixture";
import { tagRouter } from "@routes/tag";
import { accessControlRouter } from "@routes/accessControlGroup";
import { followRouter } from "@routes/follow";
import { blockRouter } from "@routes/follow";
import { notificationRouter } from "@routes/notification";
import { imageRouter } from "@routes/image";
import { signupKeyRouter } from "@routes/signupKey";
import { moderationActionRouter } from "@routes/moderationAction";
import { tagWranglingRouter } from "@routes/tagWrangling";
import { userReportRouter } from "@routes/userReport";

const getPort = () => {
    // if (process.env.NODE_ENV === "test") {
    // if (!process.env.SERVER_PORT_TEST) {
    // throw new Error("SERVER_PORT_TEST needs to be defined in .env");
    // }
    // return process.env.SERVER_PORT_TEST;
    // } else {
    return process.env.SERVER_PORT;
    // }
};

export const app = express();
app.use(
    cors({
        origin(_, callback) {
            callback(null, true);
        },
        credentials: true
    })
);

app.use(express.json({ limit: "3gb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: "/tmp/", debug: true }));

app.use("/blog", blogRouter);
app.use("/blogPost", blogPostRouter);
app.use("/comment", commentsRouter);
app.use("/community", communityRouter);
app.use("/newsfeed", newsFeedRouter);
app.use("/securityGroup", securityGroupRouter);
app.use("/DbFixtures", dbFixturesRouter);
app.use("/users", userRouter);
app.use("/alias", aliasRouter);
app.use("/tag", tagRouter);
app.use("/accessControl", accessControlRouter);
app.use("/follow", followRouter);
app.use("/block", blockRouter);
app.use("/notifications", notificationRouter);
app.use("/image", imageRouter);
app.use("/signup-key", signupKeyRouter);
app.use("/moderation-action", moderationActionRouter);
app.use("/tagWrangling", tagWranglingRouter);
app.use("/userReport", userReportRouter);

const port = getPort();

// start the Express server
export const server = app.listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`sserver started at http://localhost:${port}`);
});

// define a route handler for the default home page
app.get("/", ({}, res) => {
    res.send("Hello world2!");
});
