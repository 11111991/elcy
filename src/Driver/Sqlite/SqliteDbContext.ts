import { DbContext } from "../../Data/DBContext";
import { PlainObjectQueryResultParser } from "../../QueryBuilder/ResultParser/PlainObjectQueryResultParser";
import { SqliteQueryBuilder } from "./SqliteQueryBuilder";
import { SqliteSchemaBuilder } from "./SqliteSchemaBuilder";
import { IDriver } from "../IDriver";
import { IConnectionManager } from "../../Connection/IConnectionManager";
import { IQueryCommand } from "../../QueryBuilder/Interface/IQueryCommand";
export abstract class SqliteDbContext extends DbContext {
    public queryParser = PlainObjectQueryResultParser;
    public queryBuilderType = SqliteQueryBuilder;
    public schemaBuilderType = SqliteSchemaBuilder;
    constructor(driverFactory: () => IDriver<"sqlite">);
    constructor(connectionManagerFactory: () => IConnectionManager);
    constructor(factory: () => IConnectionManager | IDriver<"sqlite">) {
        super(factory);
    }
    public mergeQueries(queries: IQueryCommand[]): IQueryCommand[] {
        return queries;
    }
}
