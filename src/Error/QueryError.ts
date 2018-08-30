import { ORMError } from "./ORMError";

/**
 * Error throwed by Driver goes here. (all query related error)
 */
export class QueryError extends ORMError {
    constructor(code: number, message: string);
    constructor(code: number, error: Error);
    constructor(code: number, messageOrError: string | Error) {
        super(code, messageOrError as any);
    }
}