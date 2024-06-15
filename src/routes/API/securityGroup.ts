import express from "express";
import { StatusCodes } from "http-status-codes";

const securityGroupRouter = express.Router();

securityGroupRouter.get("/my", async ({}, res) => {
    // mock
    const responseObject = {
        securityGroups: [
            {
                id: 7561,
                name: "My homies",
                members: [
                    {
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 504
                        },
                        dateAdded: "2019-12-24T00:10:03.698Z"
                    },
                    {
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 1002
                        },
                        dateAdded: "2019-12-24T00:10:03.698Z"
                    },
                    {
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 504
                        },
                        dateAdded: "2019-12-24T00:10:03.698Z"
                    }
                ]
            },
            {
                id: 7571,
                name: "Shitpost brigade",
                members: [
                    {
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 504
                        },
                        dateAdded: "2019-12-24T00:10:03.698Z"
                    }
                ]
            },
            {
                id: 7581,
                name: "People into the same weird shit as i",
                members: [
                    {
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 504
                        },
                        dateAdded: "2019-12-24T00:10:03.698Z"
                    },
                    {
                        alias: {
                            name: "Annoying guy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 1002
                        },
                        dateAdded: "2019-12-24T00:10:03.698Z"
                    },
                    {
                        alias: {
                            name: "Batboy",
                            image:
                                "https://cdn2.iconfinder.com/data/icons/super-hero/154/batman-comics-hero-avatar-head-mask-512.png",
                            id: 504
                        },
                        dateAdded: "2019-12-24T00:10:03.698Z"
                    }
                ]
            }
        ]
    };
    res.send(responseObject);
});

securityGroupRouter.post("/", async (req, res) => {
    try {
        const securityGroupName = req.body.securityGroupName;

        if (securityGroupName) {
            res.status(StatusCodes.CREATED).send({ id: 345 });
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

securityGroupRouter.post("/:securityGroupId", async (req, res) => {
    try {
        const id = req.params.securityGroupId;
        const securityGroupName = req.body.securityGroupName;

        if (id && securityGroupName) {
            res.send({ id });
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

securityGroupRouter.post("/:securityGroupId/addAlias", async (req, res) => {
    try {
        const id = req.params.securityGroupId;
        const alias = req.body.alias;

        if (id && alias) {
            res.send("Alias added to security group");
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

securityGroupRouter.post("/:securityGroupId/removeAlias", async (req, res) => {
    try {
        const id = req.params.securityGroupId;
        const alias = req.body.alias;

        if (id && alias) {
            res.send("Alias removed from security group");
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

securityGroupRouter.delete("/:securityGroupId", async (req, res) => {
    try {
        const id = req.params.securityGroupId;

        if (id) {
            res.status(StatusCodes.NO_CONTENT).send();
        } else {
            res.status(StatusCodes.BAD_REQUEST).send("bad data");
        }
    } catch {
        res.status(StatusCodes.BAD_REQUEST).send("bad data");
    }
});

export { securityGroupRouter };
