import { GenericType, OrderDirection, JoinType, RelationshipType, IObjectType } from "../../Common/Type";
import { QueryBuilder } from "../../QueryBuilder/QueryBuilder";
import { IColumnExpression } from "./IColumnExpression";
import { IQueryCommandExpression } from "./IQueryCommandExpression";
import { IEntityExpression } from "./IEntityExpression";
import { IOrderExpression } from "./IOrderExpression";
import { Enumerable } from "../../Enumerable/Enumerable";
import { ProjectionEntityExpression } from "./ProjectionEntityExpression";
import { RelationMetaData } from "../../MetaData/Relation/RelationMetaData";
import { IQuery } from "../../QueryBuilder/Interface/IQuery";
import { IRelationMetaData } from "../../MetaData/Interface/IRelationMetaData";
import { IExpression } from "../../ExpressionBuilder/Expression/IExpression";
import { AndExpression } from "../../ExpressionBuilder/Expression/AndExpression";
import { IPagingExpression } from "./IPagingExpression";
import { EntityExpression } from "./EntityExpression";
import { SqlParameterExpression } from "../../ExpressionBuilder/Expression/SqlParameterExpression";
import { ISqlParameter } from "../../QueryBuilder/ISqlParameter";
import { ValueExpressionTransformer } from "../../ExpressionBuilder/ValueExpressionTransformer";
import { StrictEqualExpression } from "../../ExpressionBuilder/Expression/StrictEqualExpression";
import { hashCode, visitExpression, hashCodeAdd } from "../../Helper/Util";
import { ComputedColumnExpression } from "./ComputedColumnExpression";
import { ValueExpression } from "../../ExpressionBuilder/Expression/ValueExpression";

export interface IIncludeRelation<T = any, TChild = any> {
    child: SelectExpression<TChild>;
    parent: SelectExpression<T>;
    relations: IExpression<boolean>;
    type: RelationshipType;
    name: string;
    relationMap?: Map<IColumnExpression, IColumnExpression>;
    isFinish?: boolean;
}
export interface IJoinRelation<T = any, TChild = any> {
    child: SelectExpression<TChild>;
    parent: SelectExpression<T>;
    relations: IExpression<boolean>;
    type: JoinType;
    isFinish?: boolean;
}
export class SelectExpression<T = any> implements IQueryCommandExpression<T> {
    [prop: string]: any;
    public selects: IColumnExpression[] = [];
    public distinct: boolean;
    public isAggregate: boolean;
    public entity: IEntityExpression<T>;
    public get type() {
        return Array;
    }
    public paging: IPagingExpression = {};
    public where: IExpression<boolean>;
    public orders: IOrderExpression[] = [];
    public itemExpression: IExpression;
    public get itemType(): GenericType<any> {
        return this.itemExpression.type;
    }
    public includes: IIncludeRelation<T, any>[] = [];
    public joins: IJoinRelation<T, any>[] = [];
    public parentRelation: IJoinRelation<any, T> | IIncludeRelation<any, T>;
    public getVisitParam(): IExpression {
        return this.entity;
    }
    public parameters: SqlParameterExpression[] = [];
    public isSubSelect: boolean;
    constructor(entity: IEntityExpression<T>) {
        this.entity = entity;
        this.itemExpression = entity;

        if (entity instanceof ProjectionEntityExpression) {
            this.selects = entity.selectedColumns.slice(0);
            this.relationColumns = entity.relationColumns.slice(0);
        }
        else
            this.selects = entity.columns.where(o => o.columnMetaData && o.columnMetaData.isProjected).toArray();
        entity.select = this;
        this.orders = entity.defaultOrders.slice(0);
    }
    public get projectedColumns(): Enumerable<IColumnExpression<T>> {
        if (this.isAggregate)
            return this.selects.asEnumerable();
        let defColumns = this.entity.primaryColumns.union(this.relationColumns);
        // Version column is a must when select an Entity
        if (this.entity instanceof EntityExpression && this.entity.versionColumn) {
            defColumns = defColumns.union([this.entity.versionColumn]);
        }
        defColumns = defColumns.union(this.selects);
        if (this.distinct) {
            defColumns = defColumns.union(this.orders.select(o => {
                if ((o.column as IColumnExpression<T>).entity) {
                    return o.column as IColumnExpression<T>;
                }
                else {
                    return new ComputedColumnExpression(this.entity, o.column, "OrderColumn" as any);
                }
            }));
        }

        return defColumns;
    }
    public relationColumns: IColumnExpression[] = [];
    public addWhere(expression: IExpression<boolean>) {
        if (this.isSubSelect) {
            if (expression instanceof AndExpression) {
                this.addWhere(expression.leftOperand);
                this.addWhere(expression.rightOperand);
                return;
            }
            let isParentWhere = false;
            visitExpression(expression, (exp): boolean | void => {
                if ((exp as IColumnExpression).entity) {
                    const colExp = exp as IColumnExpression;
                    if (colExp.entity === this.entity) {
                        if (!colExp.isPrimary) this.relationColumns.add(colExp);
                    }
                    else {
                        isParentWhere = true;
                    }
                    return false;
                }
            });

            if (isParentWhere) {
                this.parentRelation.relations = this.parentRelation.relations ? new AndExpression(this.parentRelation.relations, expression) : expression;
                return;
            }
        }
        this.where = this.where ? new AndExpression(this.where, expression) : expression;
    }
    public addOrder(orders: IOrderExpression[]): void;
    public addOrder(expression: IExpression<any>, direction: OrderDirection): void;
    public addOrder(expression: IExpression<any> | IOrderExpression[], direction?: OrderDirection) {
        if (Array.isArray(expression)) {
            this.orders = this.orders.concat(expression);
        }
        else {
            this.orders.push({
                column: expression,
                direction: direction
            });
        }
    }
    public addInclude<TChild>(name: string, child: SelectExpression<TChild>, relationMeta: RelationMetaData<T, TChild>): IIncludeRelation<T, TChild>;
    public addInclude<TChild>(name: string, child: SelectExpression<TChild>, relations: IExpression<boolean>, type: RelationshipType): IIncludeRelation<T, TChild>;
    public addInclude<TChild>(name: string, child: SelectExpression<TChild>, relationMetaOrRelations: RelationMetaData<T, TChild> | IExpression<boolean>, type?: RelationshipType): IIncludeRelation<T, TChild> {
        let relationMap: IExpression<boolean>;
        if (relationMetaOrRelations instanceof RelationMetaData) {
            const relationMeta = relationMetaOrRelations;
            if (relationMeta.completeRelationType === "many-many") {
                // include to relationSelect
                let relMap = (relationMeta.isMaster ? relationMeta.relationData.sourceRelationMaps : relationMeta.relationData.targetRelationMaps);
                const relDataExp = new EntityExpression(relationMeta.relationData.type, relationMeta.relationData.name, true);
                let relationSelect = new SelectExpression(relDataExp);
                relationSelect.distinct = true;
                for (const [relColMeta, parentColMeta] of relMap) {
                    const parentCol = this.entity.columns.first((o) => o.propertyName === parentColMeta.propertyName);
                    const relationCol = relationSelect.entity.columns.first((o) => o.propertyName === relColMeta.propertyName);
                    if (!parentCol.isPrimary) this.relationColumns.add(parentCol);
                    if (!relationCol.isPrimary) relationSelect.relationColumns.add(relationCol);
                    const logicalExp = new StrictEqualExpression(parentCol, relationCol);
                    relationMap = relationMap ? new AndExpression(relationMap, logicalExp) : logicalExp;
                }
                relationSelect.parentRelation = {
                    name,
                    child: relationSelect,
                    parent: this,
                    relations: relationMap,
                    type: "many"
                };
                this.includes.push(relationSelect.parentRelation);
                relationSelect.distinct = true;

                // include child to relationSelect
                relationMap = null;
                relMap = (!relationMeta.isMaster ? relationMeta.relationData.sourceRelationMaps : relationMeta.relationData.targetRelationMaps);
                for (const [relColMeta, childColMeta] of relMap) {
                    const relationCol = relationSelect.entity.columns.first((o) => o.propertyName === relColMeta.propertyName);
                    const childCol = child.entity.columns.first((o) => o.propertyName === childColMeta.propertyName);
                    if (!relationCol.isPrimary) this.relationColumns.add(relationCol);
                    if (!childCol.isPrimary) child.relationColumns.add(childCol);
                    const logicalExp = new StrictEqualExpression(relationCol, childCol);
                    relationMap = relationMap ? new AndExpression(relationMap, logicalExp) : logicalExp;
                }
                child.parentRelation = {
                    name,
                    child,
                    parent: relationSelect,
                    relations: relationMap,
                    type: "one"
                };
                relationSelect.includes.push(child.parentRelation);
                child.distinct = true;
                return child.parentRelation;
            }

            relationMap = null;
            for (const [parentColMeta, childColMeta] of relationMeta.relationMaps) {
                const parentCol = this.entity.columns.first((o) => o.propertyName === parentColMeta.propertyName);
                const childCol = child.entity.columns.first((o) => o.propertyName === childColMeta.propertyName);
                if (!parentCol.isPrimary) this.relationColumns.add(parentCol);
                if (!childCol.isPrimary) child.relationColumns.add(childCol);
                const logicalExp = new StrictEqualExpression(parentCol, childCol);
                relationMap = relationMap ? new AndExpression(relationMap, logicalExp) : logicalExp;
            }
            type = relationMeta.relationType;

            // if it many-* relation, set distinct to avoid duplicate records
            child.distinct = relationMeta.reverseRelation.relationType === "many";
        }
        else {
            relationMap = relationMetaOrRelations as any;
            if (!relationMap) {
                relationMap = new StrictEqualExpression(new ValueExpression(true), new ValueExpression(true));
            }

            visitExpression(relationMap, (exp: IExpression): void | boolean => {
                const colExp = exp as IColumnExpression;
                if (colExp.entity && !colExp.isPrimary) {
                    if (this.entity.columns.contains(colExp)) {
                        this.relationColumns.add(colExp);
                    }
                    if (child.entity.columns.contains(colExp)) {
                        child.relationColumns.add(colExp);
                    }
                    return false;
                }
            });
            // always distinct to avoid getting duplicate entry
            child.distinct = true;
        }
        child.parentRelation = {
            name,
            child,
            parent: this,
            relations: relationMap,
            type: type!
        };
        this.includes.push(child.parentRelation);
        return child.parentRelation;
    }
    public addJoinRelation<TChild>(child: SelectExpression<TChild>, relationMeta: IRelationMetaData<T, TChild>, toOneJoinType?: JoinType): IJoinRelation<T, any>;
    public addJoinRelation<TChild>(child: SelectExpression<TChild>, relations: IExpression<boolean>, type: JoinType): IJoinRelation<T, any>;
    public addJoinRelation<TChild>(child: SelectExpression<TChild>, relationMetaOrRelations: IRelationMetaData<T, TChild> | IExpression<boolean>, type?: JoinType) {
        let relationMap: IExpression<boolean>;
        const existingRelation = this.joins.first((o) => o.child === child);
        if (existingRelation)
            return existingRelation;

        if (relationMetaOrRelations instanceof RelationMetaData) {
            const relationMeta = relationMetaOrRelations;
            if (relationMeta.completeRelationType === "many-many") {
                // include to relationSelect
                let relMap = (relationMeta.isMaster ? relationMeta.relationData.sourceRelationMaps : relationMeta.relationData.targetRelationMaps);
                const relDataExp = new EntityExpression(relationMeta.relationData.type, relationMeta.relationData.name, true);
                let relationSelect = new SelectExpression(relDataExp);
                for (const [relColMeta, parentColMeta] of relMap) {
                    const parentCol = this.entity.columns.first((o) => o.propertyName === parentColMeta.propertyName);
                    const relationCol = relationSelect.entity.columns.first((o) => o.propertyName === relColMeta.propertyName);
                    if (!relationCol.isPrimary) relationSelect.relationColumns.add(relationCol);
                    const logicalExp = new StrictEqualExpression(parentCol, relationCol);
                    relationMap = relationMap ? new AndExpression(relationMap, logicalExp) : logicalExp;
                }
                relationSelect.parentRelation = {
                    child: relationSelect,
                    parent: this,
                    relations: relationMap,
                    type: JoinType.LEFT
                };
                this.joins.push(relationSelect.parentRelation);

                relationMap = null;
                // include child to relationSelect
                relMap = (!relationMeta.isMaster ? relationMeta.relationData.sourceRelationMaps : relationMeta.relationData.targetRelationMaps);
                for (const [relColMeta, childColMeta] of relMap) {
                    const relationCol = relationSelect.entity.columns.first((o) => o.propertyName === relColMeta.propertyName);
                    const childCol = child.entity.columns.first((o) => o.propertyName === childColMeta.propertyName);
                    if (!childCol.isPrimary) child.relationColumns.add(childCol);
                    const logicalExp = new StrictEqualExpression(relationCol, childCol);
                    relationMap = relationMap ? new AndExpression(relationMap, logicalExp) : logicalExp;
                }
                child.parentRelation = {
                    child,
                    parent: relationSelect,
                    relations: relationMap,
                    type: JoinType.INNER
                };
                relationSelect.joins.push(child.parentRelation);
                return child.parentRelation;
            }
            else {
                const relType = relationMeta.source.type === this.entity.type ? relationMeta.relationType : relationMeta.reverseRelation.relationType;
                type = relType === "one" ? type ? type : JoinType.INNER : JoinType.LEFT;
                relationMap = null;
                const isReverse = relationMeta.source.type !== this.entity.type;
                for (const [parentColMeta, childColMeta] of relationMeta.relationMaps) {
                    const parentCol = this.entity.columns.first((o) => o.propertyName === (isReverse ? childColMeta : parentColMeta).propertyName);
                    const childCol = child.entity.columns.first((o) => o.propertyName === (isReverse ? parentColMeta : childColMeta).propertyName);
                    if (!childCol.isPrimary) child.relationColumns.add(childCol);
                    const logicalExp = new StrictEqualExpression(parentCol, childCol);
                    relationMap = relationMap ? new AndExpression(relationMap, logicalExp) : logicalExp;
                }
            }
        }
        else {
            relationMap = relationMetaOrRelations as any;
            if (relationMap) {
                visitExpression(relationMap, (exp: IExpression): void | boolean => {
                    const colExp = exp as IColumnExpression;
                    if (colExp.entity && !colExp.isPrimary) {
                        if (child.entity.columns.contains(colExp)) {
                            child.relationColumns.add(colExp);
                        }
                        return false;
                    }
                });
            }
        }

        child.parentRelation = {
            child: child,
            parent: this,
            relations: relationMap,
            type: type
        };
        this.joins.push(child.parentRelation);
        return child.parentRelation;
    }
    public clone(findMap?: Map<IExpression, IExpression>): SelectExpression<T> {
        if (!findMap) findMap = new Map();
        const entity = findMap.has(this.entity) ? findMap.get(this.entity) as IEntityExpression : this.entity.clone(findMap);
        findMap.set(this.entity, entity);
        // columns
        this.entity.columns.each(o => {
            const cloneCol = entity.columns.first(c => c.columnName === o.columnName);
            findMap.set(o, cloneCol);
        });

        const clone = new SelectExpression(entity);
        if (this.itemExpression !== this.entity) {
            clone.itemExpression = this.itemExpression;
        }
        clone.orders = this.orders.select(o => {
            const cloneCol = findMap.has(o.column) ? findMap.get(o.column) : o.column.clone(findMap);
            return {
                column: cloneCol,
                direction: o.direction
            } as IOrderExpression;
        }).toArray();
        clone.selects = this.selects.select(o => {
            let col = clone.entity.columns.first(c => c.columnName === o.columnName);
            if (!col) {
                col = findMap.has(o) ? findMap.get(o) as IColumnExpression : o.clone(findMap);
                col.entity = clone.entity;
            }
            return col;
        }).toArray();

        for (const parentCol of this.entity.columns) {
            const cloneCol = clone.entity.columns.first(c => c.columnName === parentCol.columnName);
            findMap.set(parentCol, cloneCol);
        }

        for (const join of this.joins) {
            const child = findMap.has(join.child) ? findMap.get(join.child) as SelectExpression : join.child.clone(findMap);
            for (const parentCol of join.child.entity.columns) {
                const cloneCol = child.entity.columns.first(c => c.columnName === parentCol.columnName);
                findMap.set(parentCol, cloneCol);
            }
            clone.addJoinRelation(child, join.relations.clone(findMap), join.type);
        }

        for (const include of this.includes) {
            const child = findMap.has(include.child) ? findMap.get(include.child) as SelectExpression : include.child.clone(findMap);
            for (const parentCol of include.child.entity.columns) {
                const cloneCol = child.entity.columns.first(c => c.columnName === parentCol.columnName);
                findMap.set(parentCol, cloneCol);
            }

            clone.addInclude(include.name, child, include.relations.clone(findMap), include.type);
        }
        if (this.where)
            clone.where = this.where.clone(findMap);

        Object.assign(clone.paging, this.paging);
        return clone;
    }
    public toQueryCommands(queryBuilder: QueryBuilder, parameters?: ISqlParameter[]): IQuery[] {
        if (parameters)
            queryBuilder.setParameters(parameters);
        return queryBuilder.getSelectQuery(this);
    }
    public execute(queryBuilder: QueryBuilder) {
        return this as any;
    }
    public toString(queryBuilder: QueryBuilder): string {
        return this.toQueryCommands(queryBuilder).select(o => o.query).toArray().join(";\n\n");
    }
    public isSimple() {
        return !this.where &&
            !this.paging.skip && !this.paging.take &&
            this.selects.all((c) => this.entity.columns.contains(c));
    }
    public buildParameter(params: { [key: string]: any }): ISqlParameter[] {
        const result: ISqlParameter[] = [];
        const valueTransformer = new ValueExpressionTransformer(params);
        for (const sqlParameter of this.parameters) {
            const value = sqlParameter.execute(valueTransformer);
            result.push({
                name: sqlParameter.name,
                parameter: sqlParameter,
                value: value
            });
        }
        return result;
    }
    public hashCode() {
        let code: number = hashCode("SELECT", hashCode(this.entity.name, this.distinct ? 1 : 0));
        code = hashCodeAdd(code, this.selects.select(o => o.hashCode()).sum());
        code = hashCode(this.where.toString(), code);
        code = hashCodeAdd(code, this.joins.sum(o => o.child.hashCode()));
        code = hashCodeAdd(code, this.includes.sum(o => o.child.hashCode()));
        return code;
    }
    public getEffectedEntities(): IObjectType[] {
        return this.entity.entityTypes
            .union(this.joins.selectMany(o => o.child.getEffectedEntities()))
            .union(this.includes.selectMany(o => o.child.getEffectedEntities()))
            .distinct().toArray();
    }
}
