import { IQueryResultParser } from "../QueryBuilder/ResultParser/IQueryResultParser";
import { ICommandQueryExpression } from "../Queryable/QueryExpression/ICommandQueryExpression";

export interface IQueryCache<T = any> {
    commandQuery: ICommandQueryExpression<T>;
    resultParser?: IQueryResultParser<T>;
}