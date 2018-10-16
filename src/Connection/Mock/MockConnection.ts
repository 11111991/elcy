import { IConnection } from "../IConnection";
import { DeferredQuery } from "../../QueryBuilder/DeferredQuery";
import { IQueryResult } from "../../QueryBuilder/IQueryResult";
import { Enumerable } from "../../Enumerable/Enumerable";
import { IIncludeRelation, SelectExpression } from "../../Queryable/QueryExpression/SelectExpression";
import { QueryType, IsolationLevel } from "../../Common/Type";
import { IColumnExpression } from "../../Queryable/QueryExpression/IColumnExpression";
import { InsertExpression } from "../../Queryable/QueryExpression/InsertExpression";
import { UpdateExpression } from "../../Queryable/QueryExpression/UpdateExpression";
import { DeleteExpression } from "../../Queryable/QueryExpression/DeleteExpression";
import { UpsertExpression } from "../../Queryable/QueryExpression/UpsertExpression";
import { UUID } from "../../Data/UUID";
import { TimeSpan } from "../../Data/TimeSpan";
import { IQuery } from "../../QueryBuilder/Interface/IQuery";
import { IBatchedQuery } from "../../QueryBuilder/Interface/IBatchedQuery";
import { EventHandlerFactory } from "../../Event/EventHandlerFactory";
import { IEventHandler, IEventDispacher } from "../../Event/IEventHandler";
import { ValueExpression } from "../../ExpressionBuilder/Expression/ValueExpression";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { SqlParameterExpression } from "../../ExpressionBuilder/Expression/SqlParameterExpression";

const charList = ["a", "a", "i", "i", "u", "u", "e", "e", "o", "o", " ", " ", " ", "h", "w", "l", "r", "y"];
let SelectExpressionType: any;
(async function () {
    SelectExpressionType = (await import("../../Queryable/QueryExpression/SelectExpression")).SelectExpression;
})();
export class MockConnection implements IConnection {
    public deferredQueries: Iterable<DeferredQuery>;
    private _results: IQueryResult[];
    public get results() {
        if (!this._results) {
            this._results = this.generateQueryResult();
        }

        return this._results;
    }
    public set results(value) {
        this._results = value;
    }
    public generateQueryResult() {
        return Enumerable.load(this.deferredQueries)
            .selectMany(o => {
                const command = o.command;
                if (command instanceof SelectExpressionType) {
                    const selects = this.flattenSelectExpression(command as any).toArray();
                    const map: Map<SelectExpression, IQueryResult> = new Map();
                    let i = 0;

                    return o.queries.select(query => {
                        const result: IQueryResult = {
                            effectedRows: 1
                        };
                        if (query.type === QueryType.DML) {
                            const arrayParameter = o.parameters.where(o => !!o.parameter.select).skip(i).first();
                            if (Array.isArray(arrayParameter.value)) {
                                result.effectedRows = arrayParameter.value.length;
                            }
                        }
                        else if (query.type === QueryType.DQL) {
                            const select = selects[i++];
                            map.set(select, result);
                            const rows: any[] = [];
                            result.rows = rows;

                            if (select.parentRelation) {
                                const parentInclude = select.parentRelation as IIncludeRelation;
                                const relMap = parentInclude.relationMap;
                                const parentQResult = map.get(parentInclude.parent);

                                const maxRowCount = this.getMaxCount(select, o, 3);

                                Enumerable.load(parentQResult.rows).each(parent => {
                                    const numberOfRecord = Math.floor(Math.random() * maxRowCount) + 1;
                                    for (let i = 0; i < numberOfRecord; i++) {
                                        const item = {} as any;
                                        select.projectedColumns.each(o => {
                                            const columnName = o.alias || o.columnName;
                                            item[columnName] = this.generateValue(o);
                                        });
                                        rows.push(item);

                                        for (const [parentCol, entityCol] of relMap) {
                                            item[entityCol.alias || entityCol.columnName] = parent[parentCol.alias || parentCol.columnName];
                                        }
                                    }
                                });
                            }
                            else {
                                const maxRowCount = this.getMaxCount(select, o, 10);
                                const numberOfRecord = Math.floor(Math.random() * maxRowCount) + 1;
                                for (let i = 0; i < numberOfRecord; i++) {
                                    const item = {} as any;
                                    select.projectedColumns.each(o => {
                                        const columnName = o.alias || o.columnName;
                                        item[columnName] = this.generateValue(o);
                                    });
                                    rows.push(item);
                                }
                            }

                            result.effectedRows = rows.length;
                        }
                        return result;
                    });
                }
                else if (command instanceof InsertExpression) {
                    const dmlCount = o.queries.where(o => o.type === QueryType.DML).count();
                    let i = 0;
                    o.queries.select(query => {
                        const result: IQueryResult = {
                            effectedRows: 1
                        };
                        if (query.type === QueryType.DML) {
                            i++;
                            if (i === dmlCount) {
                                result.effectedRows = command.values.length;
                            }
                            else {
                                const arrayParameter = o.parameters.where(o => !!o.parameter.select).skip(i).first();
                                if (Array.isArray(arrayParameter.value)) {
                                    result.effectedRows = arrayParameter.value.length;
                                }
                            }
                        }
                        return result;
                    });
                }
                else if (command instanceof UpdateExpression) {
                    const dmlCount = o.queries.where(o => o.type === QueryType.DML).count();
                    let i = 0;
                    o.queries.select(query => {
                        const result: IQueryResult = {
                            effectedRows: 1
                        };
                        if (query.type === QueryType.DML) {
                            i++;
                            if (i !== dmlCount) {
                                const arrayParameter = o.parameters.where(o => !!o.parameter.select).skip(i).first();
                                if (Array.isArray(arrayParameter.value)) {
                                    result.effectedRows = arrayParameter.value.length;
                                }
                            }
                        }
                        return result;
                    });
                }
                else if (command instanceof DeleteExpression) {
                    const dmlCount = o.queries.where(o => o.type === QueryType.DML).count();
                    let i = 0;
                    o.queries.select(query => {
                        const result: IQueryResult = {
                            effectedRows: 1
                        };
                        if (query.type === QueryType.DML) {
                            i++;
                            if (i !== dmlCount) {
                                const arrayParameter = o.parameters.where(o => !!o.parameter.select).skip(i).first();
                                if (Array.isArray(arrayParameter.value)) {
                                    result.effectedRows = arrayParameter.value.length;
                                }
                            }
                        }
                        return result;
                    });
                }
                else if (command instanceof UpsertExpression) {
                    const dmlCount = o.queries.where(o => o.type === QueryType.DML).count();
                    let i = 0;
                    o.queries.select(query => {
                        const result: IQueryResult = {
                            effectedRows: 1
                        };
                        if (query.type === QueryType.DML) {
                            i++;
                            if (i !== dmlCount) {
                                const arrayParameter = o.parameters.where(o => !!o.parameter.select).skip(i).first();
                                if (Array.isArray(arrayParameter.value)) {
                                    result.effectedRows = arrayParameter.value.length;
                                }
                            }
                        }
                        return result;
                    });
                }

                return [];
            }).toArray();
    }

    protected getMaxCount(select: SelectExpression, o: DeferredQuery, defaultValue = 10) {
        if (select.paging && select.paging.take) {
            defaultValue = this.extractValue(o, select.paging.take);
        }
        else if (select.joins.any(o => o.name === "TAKE")) {
            const takeJoin = select.joins.first(o => o.name === "TAKE") as any;
            if (takeJoin.end) {
                defaultValue = this.extractValue(o, takeJoin.end);
                if (takeJoin.start) {
                    defaultValue -= this.extractValue(o, takeJoin.start);
                }
            }
        }

        return defaultValue;
    }
    protected extractValue(o: DeferredQuery, exp: IExpression) {
        if (exp instanceof ValueExpression) {
            return exp.execute();
        }
        else {
            const sqlParam = o.parameters.first(o => o.name === (exp as SqlParameterExpression).name);
            return sqlParam ? sqlParam.value : null;
        }
    }
    protected flattenSelectExpression(selectExp: SelectExpression): Enumerable<SelectExpression> {
        return [selectExp].union(selectExp.includes.selectMany(o => this.flattenSelectExpression(o.child)), true);
    }
    public generateValue(column: IColumnExpression) {
        switch (column.type) {
            case UUID:
                return UUID.new().toString();
            case Number:
                return Number((Math.random() * 10000 + 1).toFixed(2));
            case String: {
                let result = "";
                const number = Math.random() * 100 + 1;
                for (let i = 0; i < number; i++) {
                    let char = String.fromCharCode(Math.round(Math.random() * 90) + 32);
                    if (/[^a-z ]/i.test(char)) {
                        char = charList[Math.floor(Math.random() * charList.length)];
                    }
                    result += char;
                }
                return result;
            }
            case Date: {
                const number = Math.round(Math.random() * 31536000000) + 1514653200000;
                return new Date(number);
            }
            case TimeSpan: {
                const number = Math.round(Math.random() * 86400000);
                return new TimeSpan(number);
            }
            case Boolean: {
                return Boolean(Math.round(Math.random()));
            }
        }
        return null;
    }
    public async executeQuery(command: IQuery): Promise<IQueryResult[]> {
        const batchedQuery = command as IBatchedQuery;
        const count = batchedQuery.queryCount || 0;
        return this.results.splice(0, count);
    }

    //#region Abstract Member
    public isolationLevel: IsolationLevel;
    public database: string;
    public inTransaction: boolean;
    public isOpen: boolean;
    constructor(database?: string) {
        this.database = database || "database";
        [this.errorEvent, this.onError] = EventHandlerFactory(this);
    }
    public close(): Promise<void> {
        return Promise.resolve();
    }
    public open(): Promise<void> {
        return Promise.resolve();
    }
    public reset(): Promise<void> {
        return Promise.resolve();
    }
    public startTransaction(): Promise<void> {
        return Promise.resolve();
    }
    public commitTransaction(): Promise<void> {
        return Promise.resolve();
    }
    public rollbackTransaction(): Promise<void> {
        return Promise.resolve();
    }
    public setIsolationLevel(isolationLevel: IsolationLevel): Promise<void> {
        return Promise.resolve();
    }
    public errorEvent: IEventHandler<MockConnection, Error>;
    protected onError: IEventDispacher<Error>;

    //#endregion
}