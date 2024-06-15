import jwt, { JsonWebTokenError } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User } from "@entities/User";
import { Alias } from "@entities/Alias";
import { StatusCodes } from "http-status-codes";

interface AuthRequest extends Request {
    user: User;
    token: string;
    currentAlias: number;
}

export const currentSessions: Map<string, { aliasId: number }> = new Map();

const setCurrentAlias = (
    req: AuthRequest,
    res: Response,
    aliasId: number
): void => {
    currentSessions.set(req.token, { aliasId });
    res.cookie("currentAlias", aliasId, { maxAge: Infinity });
};
const setDefaultAlias = (req: AuthRequest, res: Response, user: User): void => {
    const defaultAlias: number = user.Aliases[0].id;
    setCurrentAlias(req, res, defaultAlias);
    req.currentAlias = defaultAlias;
};

const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!process.env.JWT_KEY) {
            throw new Error("JWT_KEY needs to be defined in .env");
        }
        const authorizationHeader: string | undefined = req.header(
            "Authorization"
        );
        if (!authorizationHeader) {
            req.user = getDefaultUser();
            req.user.setDataValue("AliasIds", [0]);
            req.user.AliasIds = [0];
            req.token = "";
            req.currentAlias = 0;
            next();
        } else {
            const token: string = authorizationHeader.replace("Bearer ", "");
            const data: any = jwt.verify(token, process.env.JWT_KEY);
            const user: User | null = await User.findOne({
                where: {
                    id: data._id
                },
                include: [
                    {
                        model: Alias
                    }
                ]
            });
            if (!user) {
                req.user = getDefaultUser();
                req.user.setDataValue("AliasIds", [0]);
                req.user.AliasIds = [0];
                req.token = "";
                req.currentAlias = 0;
                next();
            } else {
                if (!user.tokens || !user.tokens.includes(token)) {
                    res.status(StatusCodes.UNAUTHORIZED).send({
                        error: "Not authorized to access this resource"
                    });
                    // i added this to stop the res send from controllers that use it. It shouldnt have  negative consequences
                    // The above statement may or may not bite me in the ass
                    throw new Error("Not authorized to access this resource");
                }
                const aliasIdArray: number[] = [];
                user.Aliases?.forEach(alias => {
                    aliasIdArray.push(alias.id);
                });
                user.setDataValue("AliasIds", aliasIdArray);
                user.AliasIds = aliasIdArray;
                user.setDataValue("loggedInAsAnonymous", false);
                req.user = user;
                req.token = token;

                if (!req.cookies.currentAlias) {
                    const session = currentSessions.get(token);
                    if (session) {
                        req.currentAlias = session.aliasId;
                    } else {
                        setDefaultAlias(req, res, user);
                    }
                } else {
                    if (
                        user.AliasIds.includes(Number(req.cookies.currentAlias))
                    ) {
                        req.currentAlias = Number(req.cookies.currentAlias);
                    } else {
                        setDefaultAlias(req, res, user);
                    }
                }
                if (req.body.alias) {
                    setCurrentAlias(req, res, req.body.alias);
                    req.currentAlias = req.body.alias;
                }
                if (!user.AliasIds.includes(Number(req.currentAlias))) {
                    throw new Error("User doesnt have the alias");
                }
                next();
            }
        }
    } catch (error) {
        console.error(error);
        if (error instanceof JsonWebTokenError) {
            req.user = getDefaultUser();
            req.user.setDataValue("AliasIds", [0]);
            req.user.AliasIds = [0];
            req.token = "";
            req.currentAlias = 0;
            next();
        } else {
            res.status(StatusCodes.UNAUTHORIZED).send({
                error: "Not authorized to access this resource"
            });
        }
    }
};
const getDefaultUser = () => {
    const user = User.build({
        email: "",
        password: "",
        tokens: "",
        maxAllowedAliases: 0
    });
    user.setDataValue("loggedInAsAnonymous", true);
    return user;
};

type middlewareFunction = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => void;

export const isModerator: middlewareFunction = (req, res, next) => {
    if (req.user.moderator || req.user.admin || req.user.superadmin) {
        next();
    } else {
        res.status(StatusCodes.FORBIDDEN).send(
            "Only a moderator or admin can perform this action"
        );
    }
};

export const isSuperTagWrangler: middlewareFunction = (req, res, next) => {
    if (req.user.superTagWrangler) {
        next();
    } else {
        res.status(StatusCodes.FORBIDDEN).send(
            "Only a super tag wrangler can perform this action"
        );
    }
};

export { auth };
export { setCurrentAlias };
export { AuthRequest };
