import { GenericType, DeleteMode, QueryType, ValueType, IObjectType } from "../Common/Type";
import { SelectExpression } from "./QueryExpression/SelectExpression";
import { DbContext } from "../Data/DBContext";
import { entityMetaKey } from "../Decorator/DecoratorKey";
import { IVisitParameter, QueryVisitor } from "../QueryBuilder/QueryVisitor";
import { hashCode, clone, hashCodeAdd, isValue } from "../Helper/Util";
import { ExpressionBuilder } from "../ExpressionBuilder/ExpressionBuilder";
import { DeferredQuery } from "../QueryBuilder/DeferredQuery";
import { ISelectQueryOption } from "../QueryBuilder/Interface/IQueryOption";
import { MethodCallExpression } from "../ExpressionBuilder/Expression/MethodCallExpression";
import { ValueExpression } from "../ExpressionBuilder/Expression/ValueExpression";
import { UpdateExpression } from "./QueryExpression/UpdateExpression";
import { IQueryCommandExpression } from "./QueryExpression/IQueryCommandExpression";
import { IExpression } from "../ExpressionBuilder/Expression/IExpression";
import { SqlParameterExpression } from "../ExpressionBuilder/Expression/SqlParameterExpression";
import { DeleteExpression } from "./QueryExpression/DeleteExpression";
import { ParameterExpression } from "../ExpressionBuilder/Expression/ParameterExpression";
import { Enumerable } from "../Enumerable/Enumerable";
import { Diagnostic } from "../Logger/Diagnostic";
import { IQueryCache } from "../Cache/IQueryCache";
import { SelectIntoExpression } from "./QueryExpression/SelectIntoExpression";
import { QueryBuilderError, QueryBuilderErrorCode } from "../Error/QueryBuilderError";
import { EqualExpression } from "../ExpressionBuilder/Expression/EqualExpression";
import { MemberAccessExpression } from "../ExpressionBuilder/Expression/MemberAccessExpression";
import { AndExpression } from "../ExpressionBuilder/Expression/AndExpression";
import { FunctionExpression } from "../ExpressionBuilder/Expression/FunctionExpression";
import { IEntityMetaData } from "../MetaData/Interface/IEntityMetaData";
import { EntityExpression } from "./QueryExpression/EntityExpression";

export abstract class Queryable<T = any> {
    public get dbContext(): DbContext {
        return this.parent.dbContext;
    }
    public queryOption: ISelectQueryOption;
    /**
     * equal to number of times queryable.parameter() was called.
     * represent the stack index of parameter used by current queryable
     */
    protected parameterStackIndex = 0;
    /**
     * all parameter used by current queryable and it's parent.
     */
    public flatParameterStacks: { [key: string]: any } = {};
    /**
     * parameter that is actually used by current queryable
     */
    public parameters: { [key: string]: any } = {};
    protected parent: Queryable;
    constructor(public type: GenericType<T>, parent?: Queryable) {
        if (parent) {
            this.parent = parent;
            this.queryOption = this.parent.queryOption;
            this.parameterStackIndex = parent.parameterStackIndex;
            this.flatParameterStacks = parent.flatParameterStacks;
            this.parameters = clone(parent.parameters);
        }
    }
    public abstract buildQuery(queryVisitor: QueryVisitor): IQueryCommandExpression<T>;
    public abstract hashCode(): number;

    //#region Get Result
    public toString() {
        const timer = Diagnostic.timer();
        let cacheKey = this.cacheKey();
        if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

        const cacheManager = this.dbContext.queryCacheManager;
        let queryCache = cacheManager.get<T>(cacheKey);
        if (Diagnostic.enabled) {
            Diagnostic.debug(this, `cache key: ${cacheKey}. cache exist: ${!!queryCache}`);
            Diagnostic.trace(this, `find cache time: ${timer.lap()}ms`);
        }
        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            const commandQuery = this.buildQuery(visitor);
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);
            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            cacheManager.set(cacheKey, queryCache);
        }
        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        queryBuilder.parameters = params;
        return queryCache.commandQuery.toString(queryBuilder);
    }
    public async toArray(): Promise<T[]> {
        const query = this.deferredToArray();
        return await query.execute();
    }
    public async count() {
        const query = this.deferredCount();
        return await query.execute();
    }
    public async contains(item: T) {
        const query = this.deferredContains(item);
        return await query.execute();
    }
    public async sum(selector?: (item: T) => number) {
        const query = this.deferredSum(selector);
        return await query.execute();
    }
    public async max(selector?: (item: T) => number) {
        const query = this.deferredMax(selector);
        return await query.execute();
    }
    public async min(selector?: (item: T) => number) {
        const query = this.deferredMin(selector);
        return await query.execute();
    }
    public async avg(selector?: (item: T) => number) {
        const query = this.deferredAvg(selector);
        return await query.execute();
    }
    public async all(predicate: (item: T) => boolean) {
        const query = this.deferredAll(predicate);
        return await query.execute();
    }
    public async any(predicate?: (item: T) => boolean) {
        const query = this.deferredAny(predicate);
        return await query.execute();
    }
    public async find(id: ValueType | { [key in keyof T]: ValueType }) {
        const query = this.deferredFind(id);
        return await query.execute();
    }
    public async first(predicate?: (item: T) => boolean) {
        const query = this.deferredFirst(predicate);
        return await query.execute();
    }
    public async update(setter: { [key in keyof T]?: ValueType | ((item: T) => ValueType) }) {
        const query = this.deferredUpdate(setter);
        return await query.execute();
    }

    public async delete(mode: DeleteMode): Promise<number>;
    public async delete(predicate?: (item: T) => boolean, mode?: DeleteMode): Promise<number>;
    public async delete(modeOrPredicate?: DeleteMode | ((item: T) => boolean), mode?: DeleteMode) {
        const query = this.deferredDelete(modeOrPredicate as any, mode);
        return await query.execute();
    }
    public async insertInto<TT>(type: IObjectType<TT>) {
        const query = this.deferredInsertInto(type);
        return await query.execute();
    }
    //#endregion

    //#region deferred
    public deferredToArray() {
        let queryCache: IQueryCache<T>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey();
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<T>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            const commandQuery = this.buildQuery(visitor);
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression. time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => {
                let i = 0;
                result = result.where(o => query.queries[i++].type === QueryType.DQL).toArray();
                return queryCache.resultParser.parse(result, this.dbContext);
            }, this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredCount() {
        let queryCache: IQueryCache<number>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("COUNT");
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<number>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const methodExpression = new MethodCallExpression(commandQuery, "count", []);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => queryCache.resultParser.parse(result, this.dbContext).first(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredSum(selector?: (item: T) => number) {
        let queryCache: IQueryCache<number>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("SUM", selector ? hashCode(selector.toString()) : undefined);
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<number>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const metParams = [];
            if (selector) {
                metParams.push(ExpressionBuilder.parse(selector));
            }
            const methodExpression = new MethodCallExpression(commandQuery, "sum", metParams);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => queryCache.resultParser.parse(result, this.dbContext).first(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredMax(selector?: (item: T) => number) {
        let queryCache: IQueryCache<number>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("MAX", selector ? hashCode(selector.toString()) : undefined);
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<number>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const metParams = [];
            if (selector) {
                metParams.push(ExpressionBuilder.parse(selector));
            }
            const methodExpression = new MethodCallExpression(commandQuery, "max", metParams);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => queryCache.resultParser.parse(result, this.dbContext).first(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredMin(selector?: (item: T) => number) {
        let queryCache: IQueryCache<number>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("MIN", selector ? hashCode(selector.toString()) : undefined);
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<number>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const metParams = [];
            if (selector) {
                metParams.push(ExpressionBuilder.parse(selector));
            }
            const methodExpression = new MethodCallExpression(commandQuery, "min", metParams);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => queryCache.resultParser.parse(result, this.dbContext).first(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredAvg(selector?: (item: T) => number) {
        let queryCache: IQueryCache<number>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("AVG", selector ? hashCode(selector.toString()) : undefined);
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<number>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const metParams = [];
            if (selector) {
                metParams.push(ExpressionBuilder.parse(selector));
            }
            const methodExpression = new MethodCallExpression(commandQuery, "avg", metParams);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => queryCache.resultParser.parse(result, this.dbContext).first(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredAll(predicate: (item: T) => boolean) {
        let queryCache: IQueryCache<boolean>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("ALL", hashCode(predicate.toString()));
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<boolean>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const metParams = [];
            if (predicate) {
                metParams.push(ExpressionBuilder.parse(predicate));
            }
            const methodExpression = new MethodCallExpression(commandQuery, "all", metParams);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => !Enumerable.load(result.first().rows).any(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredAny(predicate?: (item: T) => boolean) {
        let queryCache: IQueryCache<boolean>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("ANY", predicate ? hashCode(predicate.toString()) : undefined);
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<boolean>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const metParams = [];
            if (predicate) {
                metParams.push(ExpressionBuilder.parse(predicate));
            }
            const methodExpression = new MethodCallExpression(commandQuery, "any", metParams);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery
            };
            cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => Enumerable.load(result.first().rows).any(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredFind(id: ValueType | { [key in keyof T]: ValueType }) {
        const isValueType = isValue(id);
        const dbSet = this.dbContext.set(this.type as any);
        if (!dbSet) {
            throw new QueryBuilderError(QueryBuilderErrorCode.UsageIssue, "Find only support entity queryable");
        }

        const param = new ParameterExpression("o", this.type);
        const paramId = new ParameterExpression("id", id.constructor as any);
        let andExp: IExpression<boolean>;
        if (isValueType) {
            andExp = new EqualExpression(new MemberAccessExpression(param, dbSet.primaryKeys.first().propertyName), paramId);
        }
        else {
            for (const pk of dbSet.primaryKeys) {
                const d = new EqualExpression(new MemberAccessExpression(param, pk.propertyName), new MemberAccessExpression(paramId, pk.propertyName));
                andExp = andExp ? new AndExpression(andExp, d) : d;
            }
        }
        const a = new FunctionExpression(andExp, [param]);
        return this.parameter({ id }).where(a as any).deferredFirst();
    }
    public deferredFirst(predicate?: (item: T) => boolean) {
        let queryCache: IQueryCache<T>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("FIRST", predicate ? hashCode(predicate.toString()) : undefined);
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<T>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            const metParams = [];
            if (predicate) {
                metParams.push(ExpressionBuilder.parse(predicate));
            }
            const methodExpression = new MethodCallExpression(commandQuery, "first", metParams);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
                resultParser: this.dbContext.getQueryResultParser(commandQuery, queryBuilder)
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => {
                let i = 0;
                result = result.where(o => query.queries[i++].type === QueryType.DQL).toArray();
                return queryCache.resultParser.parse(result, this.dbContext).first();
            }, this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredContains(item: T) {
        let queryCache: IQueryCache<boolean>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            let paramStr: string;
            if (isValue(item)) {
                paramStr = item.toString();
            }
            else {
                const entityMeta = Reflect.getOwnMetadata(entityMetaKey, this.type) as IEntityMetaData<T>;
                if (entityMeta) {
                    const primaryItem = {} as T;
                    entityMeta.primaryKeys.each(o => primaryItem[o.propertyName] = item[o.propertyName]);
                    item = primaryItem;
                }
                paramStr = JSON.stringify(item);
            }
            cacheKey = this.cacheKey("CONTAINS", hashCode(paramStr));
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<boolean>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];
            const methodExpression = new MethodCallExpression(commandQuery, "contains", [new ValueExpression(item)]);
            const param: IVisitParameter = { selectExpression: commandQuery, scope: "queryable" };
            visitor.visit(methodExpression, param);
            commandQuery = param.selectExpression;
            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params,
            (result) => Enumerable.load(result.first().rows).any(), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredUpdate(setter: { [key in keyof T]?: ValueType | ((item: T) => ValueType) }) {
        let queryCache: IQueryCache<T>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("UPDATE");
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<T>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            if (!Reflect.getOwnMetadata(entityMetaKey, this.type))
                throw new Error(`Only entity supported`);

            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let commandQuery = this.buildQuery(visitor) as SelectExpression<T>;
            commandQuery.includes = [];

            const setterExp: { [key in keyof T]?: IExpression } = {};
            for (const prop in setter) {
                const val = setter[prop];
                if (val instanceof Function) {
                    const funcExp = ExpressionBuilder.parse(val as any, this.flatParameterStacks);
                    visitor.scopeParameters.add(funcExp.params[0].name, commandQuery.getVisitParam());
                    setterExp[prop] = visitor.visit(funcExp.body, { selectExpression: commandQuery, scope: "queryable" });
                    visitor.scopeParameters.remove(funcExp.params[0].name);
                }
                else {
                    setterExp[prop] = new ValueExpression(val);
                }
            }

            commandQuery.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            const updateExp = new UpdateExpression(commandQuery, setterExp);
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: updateExp,
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params, (result) => result.sum(o => o.effectedRows), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredDelete(mode: DeleteMode): DeferredQuery<number>;
    public deferredDelete(predicate?: (item: T) => boolean, mode?: DeleteMode): DeferredQuery<number>;
    public deferredDelete(modeOrPredicate?: DeleteMode | ((item: T) => boolean), mode?: DeleteMode) {
        let queryCache: IQueryCache<T>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;
        let predicate: (item: T) => boolean = null;
        if (modeOrPredicate) {
            if (modeOrPredicate instanceof Function) {
                predicate = modeOrPredicate;
            }
            else {
                mode = modeOrPredicate;
            }
        }

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("DELETE");
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<T>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            if (!Reflect.getOwnMetadata(entityMetaKey, this.type))
                throw new Error(`Only entity supported`);

            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let selectExp = this.buildQuery(visitor) as SelectExpression<T>;

            if (predicate) {
                const metParams = [];
                metParams.push(ExpressionBuilder.parse(predicate));
                const methodExpression = new MethodCallExpression(selectExp, "where", metParams);
                const param: IVisitParameter = { selectExpression: selectExp, scope: "queryable" };
                visitor.visit(methodExpression, param);
                selectExp = param.selectExpression;
            }

            selectExp.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();
            const commandQuery = new DeleteExpression(selectExp, new ParameterExpression("__deleteMode"));
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (mode) {
            params.push({
                parameter: new SqlParameterExpression("", (queryCache.commandQuery as DeleteExpression).deleteMode),
                value: mode
            });
        }
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params, (result) => result.sum(o => o.effectedRows), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }
    public deferredInsertInto<TT>(type: IObjectType<TT>) {
        const targetSet = this.dbContext.set(type);

        let queryCache: IQueryCache<T>, cacheKey: number;
        const timer = Diagnostic.timer();
        const cacheManager = this.dbContext.queryCacheManager;

        if (!this.queryOption.noQueryCache) {
            cacheKey = this.cacheKey("INSERT");
            if (Diagnostic.enabled) Diagnostic.trace(this, `cache key: ${cacheKey}. build cache key time: ${timer.lap()}ms`);

            queryCache = cacheManager.get<T>(cacheKey);
            if (Diagnostic.enabled) {
                Diagnostic.debug(this, `find query expression cache with key: ${cacheKey}. cache exist: ${!!queryCache}`);
                Diagnostic.trace(this, `find query expression cache time: ${timer.lap()}ms`);
            }
        }

        const queryBuilder = this.dbContext.queryBuilder;
        queryBuilder.options = clone(this.queryOption, true);
        if (!queryCache) {
            if (!Reflect.getOwnMetadata(entityMetaKey, this.type))
                throw new Error(`Only entity supported`);

            const visitor = this.dbContext.queryVisitor;
            visitor.options = queryBuilder.options;
            let selectExp = this.buildQuery(visitor) as SelectExpression<T>;
            if (!this.dbContext.entityTypes.contains(selectExp.itemExpression.type as any))
                throw new QueryBuilderError(QueryBuilderErrorCode.UsageIssue, `Insert ${selectExp.itemExpression.type.name} not supported`);

            selectExp.parameters = visitor.sqlParameters.asEnumerable().select(o => o[1]).toArray();

            const entityExp = new EntityExpression(targetSet.type, visitor.newAlias());
            const commandQuery = new SelectIntoExpression(entityExp, selectExp);
            if (Diagnostic.enabled) Diagnostic.trace(this, `build query expression time: ${timer.lap()}ms`);

            queryCache = {
                commandQuery: commandQuery,
            };
            if (!this.queryOption.noQueryCache) cacheManager.set(cacheKey, queryCache);
        }

        const params = queryCache.commandQuery.buildParameter(this.flatParameterStacks);
        if (Diagnostic.enabled) Diagnostic.trace(this, `build params time: ${timer.lap()}ms`);

        const query = new DeferredQuery(this.dbContext, queryCache.commandQuery, params, (result) => result.sum(o => o.effectedRows), this.queryOption);
        this.dbContext.deferredQueries.add(query);
        return query;
    }

    private cacheKey(type?: string, addCode?: number) {
        let cacheKey = hashCode(type, this.hashCode());
        if (addCode) cacheKey = hashCodeAdd(cacheKey, addCode);
        if (this.queryOption) cacheKey = hashCode(this.queryOption.buildKey, cacheKey);
        const subQueryCacheKey = Object.keys(this.flatParameterStacks)
            .select(o => {
                const val = this.flatParameterStacks[o];
                return val instanceof Queryable ? val.hashCode() : val instanceof Function ? hashCode(val.toString()) : 0;
            }).sum();
        cacheKey = hashCodeAdd(subQueryCacheKey, cacheKey);
        if (this.queryOption && this.queryOption.includeSoftDeleted)
            cacheKey = hashCodeAdd(cacheKey, 1);
        return cacheKey;
    }
    //#endregion
}
