class ErrorReportService {
    public static getEnvError(e: Error | string, errorCode: string) {
        const env = process.env.NODE_ENV;
        if (env === "production") {
            return errorCode;
        } else {
            if (typeof e === "string") {
                return e;
            }
            return e.message;
        }
    }
}

export { ErrorReportService };
