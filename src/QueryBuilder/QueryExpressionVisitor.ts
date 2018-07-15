import "../Extensions/StringExtension";
import { JoinType, OrderDirection, RelationshipType } from "../Common/Type";
import { relationMetaKey, columnMetaKey } from "../Decorator/DecoratorKey";
import { TransformerParameter } from "../ExpressionBuilder/TransformerParameter";
import { isValueType, isNativeFunction, hashCode, isNotNull } from "../Helper/Util";
import { EntityExpression } from "../Queryable/QueryExpression/EntityExpression";
import { GroupByExpression } from "../Queryable/QueryExpression/GroupByExpression";
import { IColumnExpression } from "../Queryable/QueryExpression/IColumnExpression";
import { SelectExpression, IJoinRelation, IIncludeRelation } from "../Queryable/QueryExpression/SelectExpression";
import { GroupedExpression } from "../Queryable/QueryExpression/GroupedExpression";
import { ExpressionBuilder } from "../ExpressionBuilder/ExpressionBuilder";
import { ISqlParameterBuilderItem } from "./ParameterBuilder/ISqlParameterBuilderItem";
import { InstantiationExpression } from "../ExpressionBuilder/Expression/InstantiationExpression";
import { RelationMetaData } from "../MetaData/Relation/RelationMetaData";
import { EmbeddedColumnExpression } from "../Queryable/QueryExpression/EmbeddedColumnExpression";
import { IMemberOperatorExpression } from "../ExpressionBuilder/Expression/IMemberOperatorExpression";
import { IExpression } from "../ExpressionBuilder/Expression/IExpression";
import { ProjectionEntityExpression } from "../Queryable/QueryExpression/ProjectionEntityExpression";
import { ComputedColumnExpression } from "../Queryable/QueryExpression/ComputedColumnExpression";
import { ColumnExpression } from "../Queryable/QueryExpression/ColumnExpression";
import { MethodCallExpression } from "../ExpressionBuilder/Expression/MethodCallExpression";
import { MemberAccessExpression } from "../ExpressionBuilder/Expression/MemberAccessExpression";
import { TernaryExpression } from "../ExpressionBuilder/Expression/TernaryExpression";
import { FunctionCallExpression } from "../ExpressionBuilder/Expression/FunctionCallExpression";
import { NotExpression } from "../ExpressionBuilder/Expression/NotExpression";
import { IUnaryOperatorExpression } from "../ExpressionBuilder/Expression/IUnaryOperatorExpression";
import { AndExpression } from "../ExpressionBuilder/Expression/AndExpression";
import { EqualExpression } from "../ExpressionBuilder/Expression/EqualExpression";
import { NotEqualExpression } from "../ExpressionBuilder/Expression/NotEqualExpression";
import { IBinaryOperatorExpression } from "../ExpressionBuilder/Expression/IBinaryOperatorExpression";
import { ObjectValueExpression } from "../ExpressionBuilder/Expression/ObjectValueExpression";
import { ArrayValueExpression } from "../ExpressionBuilder/Expression/ArrayValueExpression";
import { FunctionExpression } from "../ExpressionBuilder/Expression/FunctionExpression";
import { ParameterExpression } from "../ExpressionBuilder/Expression/ParameterExpression";
import { ValueExpression } from "../ExpressionBuilder/Expression/ValueExpression";
import { IEntityExpression } from "../Queryable/QueryExpression/IEntityExpression";
import { IOrderExpression } from "../Queryable/QueryExpression/IOrderExpression";
import { UnionExpression } from "../Queryable/QueryExpression/UnionExpression";
import { IntersectExpression } from "../Queryable/QueryExpression/IntersectExpression";
import { ExceptExpression } from "../Queryable/QueryExpression/ExceptExpression";
import { ComputedColumnMetaData } from "../MetaData/ComputedColumnMetaData";
import { EmbeddedColumnMetaData } from "../MetaData/EmbeddedColumnMetaData";
import { ValueExpressionTransformer } from "../ExpressionBuilder/ValueExpressionTransformer";
import { ExpressionTransformer } from "../ExpressionBuilder/ExpressionTransformer";
import { QueryBuilder } from "./QueryBuilder";

const extract = (o: IExpression, qv: QueryExpressionVisitor): [IExpression, boolean] => {
    if (o instanceof ParameterExpression) {
        const existing = qv.sqlParameterBuilderItems.find(p => p.name === o.name);
        qv.sqlParameterBuilderItems.remove(existing);
        return [existing.valueGetter, true];
    }
    return [o, false];
};
const extractValue = (o: IExpression, qv: QueryExpressionVisitor) => {
    if (o instanceof ParameterExpression) {
        const existing = qv.sqlParameterBuilderItems.find(p => p.name === o.name);
        qv.sqlParameterBuilderItems.remove(existing);
        const value = existing.valueGetter.execute(qv.expressionTransformer);
        return new ValueExpression(value);
    }
    return o;
};
const isSafe = (o: IExpression, qv: QueryExpressionVisitor) => {
    if (o instanceof ParameterExpression) {
        const scopeParam = qv.scopeParameters.get(o.name);
        return typeof scopeParam === "undefined";
    }
    return o instanceof ValueExpression;
};
interface IPRelation {
    name: string;
    relations: Map<any, any>;
    child: SelectExpression<any>;
    type: RelationshipType;
}
export interface IQueryVisitParameter {
    commandExpression: SelectExpression;
    scope?: string;
}
export class QueryExpressionVisitor {
    public sqlParameterBuilderItems: ISqlParameterBuilderItem[] = [];
    public userParameters: { [key: string]: any } = {};
    public scopeParameters = new TransformerParameter();
    private aliasObj: { [key: string]: number } = {};
    constructor(protected queryBuilder: QueryBuilder) {
    }
    public newAlias(type: "entity" | "column" | "param" = "entity") {
        if (!this.aliasObj[type])
            this.aliasObj[type] = 0;
        return this.queryBuilder.namingStrategy.getAlias(type) + this.aliasObj[type]++;
    }
    private _expressionTransformer: ExpressionTransformer;
    public get expressionTransformer() {
        if (!this._expressionTransformer) {
            this._expressionTransformer = new ValueExpressionTransformer(this.userParameters);
        }
        return this._expressionTransformer;
    }
    protected createParamBuilderItem(expression: IExpression) {
        const result = new ParameterExpression("param_" + Math.abs(hashCode(expression.toString())));
        this.sqlParameterBuilderItems.push({ name: result.name, valueGetter: expression });
        const val = expression.execute(this.expressionTransformer);
        if (isNotNull(val))
            result.type = val.constructor;
        return result;
    }

    //#region visit parameter
    public visit(expression: IExpression, param: IQueryVisitParameter): IExpression {
        if (!(expression instanceof SelectExpression ||
            expression instanceof EntityExpression || expression instanceof ProjectionEntityExpression ||
            expression instanceof ColumnExpression || expression instanceof ComputedColumnExpression))
            expression = expression.clone();
        switch (expression.constructor) {
            case MethodCallExpression:
            case MemberAccessExpression: {
                const memberExpression = expression as IMemberOperatorExpression<any>;
                memberExpression.objectOperand = this.visit(memberExpression.objectOperand, param);
                if (memberExpression.objectOperand instanceof TernaryExpression) {
                    const ternaryExp = memberExpression.objectOperand as TernaryExpression<any, any>;
                    const trueOperand = memberExpression.clone();
                    trueOperand.objectOperand = ternaryExp.trueResultOperand;
                    const falseOperand = memberExpression.clone();
                    falseOperand.objectOperand = ternaryExp.falseResultOperand;
                    return new TernaryExpression(ternaryExp.logicalOperand, this.visit(trueOperand, param), this.visit(falseOperand, param));
                }
                return expression instanceof MemberAccessExpression ? this.visitMember(expression as any, param) : this.visitMethod(expression as any, param);
            }
            case FunctionCallExpression:
                return this.visitFunctionCall(expression as any, param);
            case InstantiationExpression:
                return this.visitInstantiation(expression as any, param);
            case TernaryExpression:
                return this.visitTernaryOperator(expression as any, param);
            case ObjectValueExpression:
                return this.visitObjectLiteral(expression as ObjectValueExpression<any>, param);
            case ArrayValueExpression:
                throw new Error(`literal Array not supported`);
            case FunctionExpression:
                return this.visitFunction(expression as FunctionExpression, param);
            case ParameterExpression:
                return this.visitParameter(expression as any, param);
            default: {
                if ((expression as IBinaryOperatorExpression).leftOperand) {
                    return this.visitBinaryOperator(expression as any, param);
                }
                else if ((expression as IUnaryOperatorExpression).operand) {
                    return this.visitUnaryOperator(expression as any, param);
                }
            }
        }
        return expression;
    }
    protected visitParameter<T>(expression: ParameterExpression<T>, param: IQueryVisitParameter) {
        let result = this.scopeParameters.get(expression.name);
        if (!result) {
            result = this.createParamBuilderItem(expression);
            return result;
        }
        return result;
    }
    protected visitFunction<T, TR>(expression: FunctionExpression<T, TR>, param: IQueryVisitParameter) {
        return this.visit(expression.body, param);
    }
    protected visitMember<TType, KProp extends keyof TType>(expression: MemberAccessExpression<TType, KProp>, param: IQueryVisitParameter): IExpression {
        const objectOperand = expression.objectOperand;
        if (expression.memberName === "prototype" || expression.memberName === "__proto__")
            throw new Error(`property ${expression.memberName} not supported in linq to sql.`);

        if (objectOperand instanceof EntityExpression || objectOperand instanceof ProjectionEntityExpression || objectOperand instanceof EmbeddedColumnExpression) {
            const parentEntity = objectOperand as IEntityExpression;
            let column = parentEntity.columns.first((c) => c.propertyName === expression.memberName);
            if (!column && objectOperand instanceof EntityExpression) {
                const computedColumnMeta = Reflect.getOwnMetadata(columnMetaKey, objectOperand.type, expression.memberName as string);
                if (computedColumnMeta instanceof ComputedColumnMetaData) {
                    let paramName: string;
                    if (computedColumnMeta.functionExpression.params.length > 0)
                        paramName = computedColumnMeta.functionExpression.params[0].name;
                    if (paramName)
                        this.scopeParameters.add(paramName, objectOperand);
                    const result = this.visit(computedColumnMeta.functionExpression.clone(), { commandExpression: param.commandExpression });
                    if (paramName)
                        this.scopeParameters.remove(paramName);
                    if (result instanceof EntityExpression || result instanceof SelectExpression)
                        throw new Error(`${objectOperand.type.name}.${expression.memberName} not supported`);

                    column = new ComputedColumnExpression(parentEntity, result, expression.memberName as any);
                }
                else if (computedColumnMeta instanceof EmbeddedColumnMetaData) {
                    column = new EmbeddedColumnExpression(parentEntity, computedColumnMeta);
                }
            }
            if (column) {
                switch (param.scope) {
                    case "include":
                        if (parentEntity instanceof EmbeddedColumnExpression) {
                            if (!(column instanceof ComputedColumnExpression) && !(column instanceof EmbeddedColumnExpression)) {
                                parentEntity.clearDefaultColumns();
                            }
                        }
                        if (parentEntity.select) {
                            if (!(column instanceof ComputedColumnExpression) && !(column instanceof EmbeddedColumnExpression)) {
                                parentEntity.select.clearDefaultColumns();
                            }
                        }
                        break;
                }
                if (parentEntity instanceof EmbeddedColumnExpression) {
                    parentEntity.selects.add(column);
                }
                else if (parentEntity.select) {
                    parentEntity.select.selects.add(column);
                }
                return column;
            }
            const relationMeta: RelationMetaData<TType, any> = Reflect.getOwnMetadata(relationMetaKey, objectOperand.type, expression.memberName as string);
            if (relationMeta) {
                const targetType = relationMeta.target.type;
                switch (param.scope) {
                    case "select":
                    case "selectMany":
                        {
                            let child = new SelectExpression(new EntityExpression(targetType, this.newAlias()));
                            if (relationMeta.relationType === "many" && param.scope === "select") {
                                param.commandExpression.itemExpression = child;
                                param.commandExpression.selects = [];
                                param.commandExpression.addInclude("", child, relationMeta);
                                return param.commandExpression;
                            }
                            else {
                                child.addJoinRelation(param.commandExpression, relationMeta.reverseRelation);
                                child.addOrder(param.commandExpression.orders);
                                param.commandExpression = child;
                                return relationMeta.relationType === "many" ? child : child.entity;
                            }
                        }
                    case "include":
                        {
                            let child = new SelectExpression(new EntityExpression(targetType, this.newAlias()));
                            parentEntity.select!.addInclude(expression.memberName as any, child, relationMeta);
                            return relationMeta.relationType === "many" ? child : child.entity;
                        }
                    default:
                        {
                            let child = new SelectExpression(new EntityExpression(targetType, this.newAlias()));
                            let joinType: JoinType;
                            if (param.scope === "orderBy")
                                joinType = JoinType.LEFT;
                            parentEntity.select!.addJoinRelation(child, relationMeta, joinType);
                            return relationMeta.relationType === "many" ? child : child.entity;
                        }
                }
            }
        }
        else if (objectOperand instanceof SelectExpression && expression.memberName === "length") {
            return this.visit(new MethodCallExpression(objectOperand, "count", []), param);
        }
        else if (objectOperand instanceof GroupedExpression) {
            if (expression.memberName === "key") {
                const result = objectOperand.key;
                if ((result as IColumnExpression).entity)
                    return result;
                else if (result instanceof ObjectValueExpression) {
                    return result;
                }
                else if ((result as IEntityExpression).primaryColumns) {
                    switch (param.scope) {
                        case "select":
                        case "selectMany":
                            {
                                let child = new SelectExpression(new EntityExpression(result.type as any, this.newAlias()));
                                const relMap = new Map();
                                for (const childCol of child.entity.primaryColumns) {
                                    const parentCol = param.commandExpression.projectedColumns.first(o => o.columnName === childCol.columnName);
                                    relMap.set(childCol, parentCol);
                                }
                                child.addJoinRelation(param.commandExpression, relMap, JoinType.INNER);
                                child.addOrder(param.commandExpression.orders);
                                param.commandExpression = child;
                                return child.entity;
                            }
                        default:
                            {
                                return result;
                            }
                    }
                }
            }
        }
        else if (objectOperand instanceof ParameterExpression) {
            const existing = this.sqlParameterBuilderItems.find(o => o.name === objectOperand.name);
            this.sqlParameterBuilderItems.remove(existing);
            expression.objectOperand = existing.valueGetter;
            const result = this.createParamBuilderItem(expression);
            return result;
        }
        else if (objectOperand instanceof ObjectValueExpression) {
            const result = objectOperand.object[expression.memberName];
            if ((result as IEntityExpression).primaryColumns) {
                switch (param.scope) {
                    case "selectMany":
                        throw new Error("select many not support select entity");
                    case "select": {
                        const relMap = new Map();
                        for (const childCol of result.primaryColumns) {
                            const parentCol = param.commandExpression.projectedColumns.first(o => o.columnName === childCol.columnName);
                            relMap.set(childCol, parentCol);
                        }
                        result.select.addJoinRelation(param.commandExpression, relMap, JoinType.INNER);
                        result.select.addOrder(param.commandExpression.orders);
                        param.commandExpression = result.select;
                        return result;
                    }
                }
            }
            else if (result instanceof SelectExpression) {
                switch (param.scope) {
                    case "select":
                    case "selectMany": {
                        if (result.parentRelation.type === "many" && param.scope === "select") {
                            param.commandExpression.itemExpression = result;
                            param.commandExpression.selects = [];
                            return param.commandExpression;
                        }
                        else {
                            const relationMap = new Map();
                            const parentRelation = result.parentRelation as IIncludeRelation;
                            for (const [parentCol, childCol] of parentRelation.relations) {
                                relationMap.set(childCol, parentCol);
                            }
                            result.parentRelation = null;
                            parentRelation.parent.includes.remove(parentRelation);
                            result.addJoinRelation(param.commandExpression, relationMap, JoinType.INNER);
                            result.addOrder(param.commandExpression.orders);
                            param.commandExpression = result;
                            return parentRelation.type === "many" ? result : result.entity;
                        }
                    }
                }
            }
            return result;
        }
        else if (objectOperand instanceof EmbeddedColumnExpression) {

        }
        else {
            const isExpressionSafe = isSafe(objectOperand, this);

            let translator;
            if (objectOperand instanceof ValueExpression) {
                translator = this.queryBuilder.resolveTranslator(objectOperand.value, expression.memberName as any);
                if (translator && !(translator.preferApp && isExpressionSafe)) {
                    return expression;
                }
            }

            if (!translator && !(translator.preferApp && isExpressionSafe)) {
                translator = this.queryBuilder.resolveTranslator(objectOperand.type.prototype, expression.memberName as any);
                if (translator)
                    return expression;
            }
            
            // Execute in app if all parameter is available.
            if (isExpressionSafe) {
                let hasParam = false;
                [expression.objectOperand, hasParam] = extract(expression.objectOperand, this);
                if (hasParam) {
                    const result = this.createParamBuilderItem(expression);
                    return result;
                }
                return new ValueExpression(expression.execute());
            }
        }

        throw new Error(`${objectOperand.type.name}.${expression.memberName} is invalid or not supported in linq to sql.`);
    }
    protected visitInstantiation<TType>(expression: InstantiationExpression<TType>, param: IQueryVisitParameter): IExpression {
        const clone = expression.clone();
        expression.typeOperand = this.visit(expression.typeOperand, param);
        expression.params = expression.params.select(o => this.visit(o, param)).toArray();
        const paramExps: ParameterExpression[] = [];
        if (isSafe(expression.typeOperand, this) && expression.params.all(o => isSafe(o, this))) {
            paramExps.forEach(o => {
                const existing = this.sqlParameterBuilderItems.find(p => p.name === o.name);
                if (existing)
                    this.sqlParameterBuilderItems.remove(existing);
            });

            const result = this.createParamBuilderItem(clone);
            return result;
        }
        else {
            // TODO: sql query representation for each default object type intantiation
        }
        throw new Error(`${expression.type.name} not supported.`);
    }
    protected visitObjectSelect(selectOperand: SelectExpression, selectExp: ObjectValueExpression<any>, prevPath?: string) {
        let newSelects: IColumnExpression[] = [];
        const joinRelations: Array<IPRelation> = [];
        for (const prop in selectExp.object) {
            const propPath = prevPath ? prevPath + "." + prop : prop;
            const valueExp = selectExp.object[prop];
            if (valueExp instanceof EntityExpression) {
                let childEntity = valueExp as IEntityExpression;
                let parentRel: IJoinRelation<any, any> = childEntity.select.parentRelation as any;

                if (selectOperand instanceof GroupByExpression && childEntity === selectOperand.key) {
                    const relMap = new Map();
                    const cloneSelect = childEntity.select.clone();
                    cloneSelect.joins = [];
                    childEntity = cloneSelect.entity;
                    for (const [parentCol, childCol] of (selectOperand.key as any).select.parentRelation.relations) {
                        const cloneCol = childEntity.columns.first(o => o.columnName === childCol.columnName);
                        relMap.set(parentCol, cloneCol);
                    }
                    const pr: IPRelation = {
                        name: prop,
                        child: cloneSelect,
                        relations: relMap,
                        type: "one"
                    };
                    joinRelations.push(pr);
                }
                else if (childEntity === selectOperand.entity) {
                    const relationMap = new Map();
                    const cloneSelect = childEntity.select.clone();
                    cloneSelect.joins = [];
                    childEntity = cloneSelect.entity;
                    for (let i = 0; i < selectOperand.entity.primaryColumns.length; i++) {
                        const pCol = selectOperand.entity.primaryColumns[i];
                        const cCol = childEntity.primaryColumns[i];
                        relationMap.set(pCol, cCol);
                    }
                    const pr: IPRelation = {
                        name: prop,
                        child: cloneSelect,
                        relations: relationMap,
                        type: "one"
                    };
                    joinRelations.push(pr);
                }
                else {
                    while ((parentRel as any).name === undefined && parentRel.parent !== selectOperand) {
                        const relationMap = new Map<any, any>();
                        for (const [sourceCol, targetCol] of parentRel.relations) {
                            relationMap.set(targetCol, sourceCol);
                        }
                        const nextRel = parentRel.parent.parentRelation as IJoinRelation<any, any>;
                        parentRel.parent.joins.remove(parentRel);
                        parentRel.child.addJoinRelation(parentRel.parent, relationMap, JoinType.INNER);
                        if (!parentRel) break;
                        parentRel = nextRel;
                    }
                    selectOperand.joins.remove(parentRel);
                    const pr: IPRelation = {
                        name: prop,
                        child: valueExp.select,
                        relations: parentRel.relations,
                        type: "one"
                    };
                    joinRelations.push(pr);
                }
            }
            // group only
            else if (valueExp instanceof GroupedExpression) {
                let parentRel = valueExp.parentRelation as IJoinRelation<any, any>;
                selectOperand.joins.remove(parentRel);
                const childSelect = valueExp.clone();
                const relMap = new Map();
                for (const col of selectOperand.groupBy) {
                    const childCol = childSelect.projectedColumns.union([selectOperand.key as any]).first(o => o.columnName === col.columnName);
                    relMap.set(col, childCol);
                }
                const pr: IPRelation = {
                    name: prop,
                    child: childSelect,
                    relations: relMap,
                    type: "many"
                };
                joinRelations.push(pr);
            }
            // non group only
            else if (valueExp instanceof SelectExpression) {
                let parentRel = valueExp.parentRelation as IJoinRelation<any, any>;
                while ((parentRel as any).name === undefined && parentRel.parent !== selectOperand) {
                    const relationMap = new Map<any, any>();
                    for (const [sourceCol, targetCol] of parentRel.relations) {
                        relationMap.set(targetCol, sourceCol);
                    }
                    const nextRel = parentRel.parent.parentRelation as IJoinRelation<any, any>;
                    parentRel.parent.joins.remove(parentRel);
                    parentRel.child.addJoinRelation(parentRel.parent, relationMap, JoinType.INNER);
                    if (!parentRel) break;
                    parentRel = nextRel;
                }

                selectOperand.joins.remove(parentRel);
                const pr: IPRelation = {
                    name: prop,
                    child: valueExp,
                    relations: parentRel.relations,
                    type: "many"
                };
                joinRelations.push(pr);
            }
            else if (valueExp instanceof ObjectValueExpression) {
                newSelects = newSelects.concat(this.visitObjectSelect(selectOperand, valueExp, propPath));
            }
            else if ((valueExp as IColumnExpression).entity) {
                if (!(selectOperand instanceof GroupByExpression) && valueExp instanceof ComputedColumnExpression) {
                    const column = new ColumnExpression(valueExp.entity, valueExp.type, propPath, valueExp.columnName, valueExp.isPrimary, valueExp.columnType);
                    newSelects.add(column);
                }
                else {
                    valueExp.propertyName = propPath;
                    newSelects.add(valueExp);
                }
            }
            else {
                const column = new ComputedColumnExpression(selectOperand.entity, valueExp, prop);
                column.propertyName = propPath;
                newSelects.add(column);
            }
        }
        for (const rel of joinRelations)
            selectOperand.addInclude(rel.name, rel.child, rel.relations, rel.type);
        return newSelects;
    }
    protected visitObjectGroup(selectOperand: SelectExpression, selectExp: ObjectValueExpression<any>, groupColumns: IColumnExpression[] = [], selectColumns: IColumnExpression[], prevPath: string) {
        const joinRelations: Array<IPRelation> = [];
        for (const prop in selectExp.object) {
            const propPath = prevPath ? prevPath + "." + prop : prop;
            const valueExp = selectExp.object[prop];
            if ((valueExp as IEntityExpression).primaryColumns) {
                const entityExp = valueExp as IEntityExpression;
                for (const [parentCol] of entityExp.select.parentRelation.relations) {
                    groupColumns.push(parentCol);
                }
                // remove relation
                selectOperand.joins.remove(entityExp.select.parentRelation as any);
                // add include
                selectOperand.addInclude(propPath, entityExp.select, entityExp.select.parentRelation.relations, "one");
            }
            else if (valueExp instanceof SelectExpression) {
                throw new Error(`${propPath} Array not supported`);
            }
            else if (valueExp instanceof ObjectValueExpression) {
                this.visitObjectGroup(selectOperand, valueExp, groupColumns, selectColumns, propPath);
            }
            else if ((valueExp as IColumnExpression).entity) {
                valueExp.propertyName = propPath;
                groupColumns.push(valueExp);
                selectColumns.push(valueExp);
            }
            else {
                const col = new ComputedColumnExpression(selectOperand.entity, valueExp, this.newAlias("column"));
                col.propertyName = propPath;
                selectExp.object[prop] = col;
                groupColumns.push(col);
                selectColumns.push(col);
            }
        }
        for (const rel of joinRelations)
            selectOperand.addInclude(rel.name, rel.child, rel.relations, rel.type);
        return selectColumns;
    }
    protected visitMethod<TType, KProp extends keyof TType, TResult = any>(expression: MethodCallExpression<TType, KProp, TResult>, param: IQueryVisitParameter): IExpression {
        const objectOperand = expression.objectOperand;

        if (objectOperand instanceof SelectExpression) {
            let selectOperand = objectOperand as SelectExpression;
            switch (expression.methodName) {
                case "select":
                case "selectMany": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    // clear includes coz select one return selected value without it's relations
                    selectOperand.includes = [];

                    const parentRelation = objectOperand.parentRelation;
                    const selectorFn = expression.params[0] as FunctionExpression<TType, TResult>;
                    const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: param.scope === "queryable" ? expression.methodName : "" };
                    this.scopeParameters.add(selectorFn.params[0].name, selectOperand.getVisitParam());
                    const selectExp = this.visit(selectorFn, visitParam);
                    this.scopeParameters.remove(selectorFn.params[0].name);
                    // todo recheck
                    selectOperand = param.commandExpression = visitParam.commandExpression;

                    if (expression.methodName === "select") {
                        if (selectExp instanceof SelectExpression) {
                            if (selectOperand instanceof GroupByExpression)
                                throw new Error(`groupBy did not support to many select result`);
                            selectOperand = selectExp;
                        }
                        else if ((selectExp as EntityExpression).primaryColumns) {
                            selectOperand = visitParam.commandExpression;
                        }
                        else if (selectExp instanceof ObjectValueExpression) {
                            selectOperand.selects = this.visitObjectSelect(selectOperand, selectExp);
                            selectOperand.itemExpression = selectExp;
                        }
                        else if ((selectExp as IColumnExpression).entity) {
                            const column = selectExp as IColumnExpression;
                            selectOperand.itemExpression = column;
                            selectOperand.selects = [column];
                        }
                        else if (selectExp instanceof TernaryExpression) {
                            // TODO
                        }
                        else {
                            const column = new ComputedColumnExpression(selectOperand.entity, selectExp, this.newAlias("column"));
                            selectOperand.itemExpression = column;
                            selectOperand.selects = [column];
                        }
                    }
                    else {
                        if (!(selectExp instanceof SelectExpression)) {
                            throw new Error(`Queryable<${objectOperand.type}>.selectMany required selector with array or queryable or enumerable return value.`);
                        }
                        selectOperand = selectExp;
                    }

                    if (parentRelation) {
                        parentRelation.child = selectOperand;
                        selectOperand.parentRelation = parentRelation;
                    }
                    else {
                        param.commandExpression = selectOperand;
                    }

                    return selectOperand;
                }
                case "where": {
                    if (selectOperand instanceof GroupedExpression) {
                        const clone = selectOperand.clone();
                        clone.entity.alias = this.newAlias();
                        clone.where = null;
                        clone.joins = [];
                        const map = new Map();
                        for (const parentCol of selectOperand.entity.primaryColumns) {
                            const childCol = clone.entity.columns.first(o => o.columnName === parentCol.columnName);
                            map.set(parentCol, childCol);
                        }
                        param.commandExpression.addJoinRelation(clone, map, JoinType.LEFT);
                        selectOperand = clone;
                    }

                    const predicateFn = expression.params[0] as FunctionExpression<TType, boolean>;
                    const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: "where" };
                    this.scopeParameters.add(predicateFn.params[0].name, selectOperand.getVisitParam());
                    const whereExp = this.visit(predicateFn, visitParam) as IExpression<boolean>;
                    this.scopeParameters.remove(predicateFn.params[0].name);

                    if (whereExp.type !== Boolean) {
                        throw new Error(`Queryable<${objectOperand.type}>.where required predicate with boolean return value.`);
                    }

                    selectOperand.addWhere(whereExp);
                    return selectOperand;
                }
                case "orderBy": {
                    const selectors = expression.params as ObjectValueExpression<any>[];
                    const orders: IOrderExpression[] = [];
                    for (const selector of selectors) {
                        const selectorFn = selector.object.selector as FunctionExpression<TType, any>;
                        const direction = selector.object.direction ? selector.object.direction as ValueExpression<OrderDirection> : new ValueExpression(OrderDirection.ASC);
                        const visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: expression.methodName };
                        this.scopeParameters.add(selectorFn.params[0].name, objectOperand.getVisitParam());
                        const selectExp = this.visit(selectorFn, visitParam) as IColumnExpression;
                        this.scopeParameters.remove(selectorFn.params[0].name);

                        if (!isValueType(selectExp.type)) {
                            throw new Error(`Queryable<${objectOperand.type}>.orderBy required select with basic type return value.`);
                        }
                        orders.push({
                            column: selectExp,
                            direction: direction.value
                        });
                    }
                    if (orders.length > 0) {
                        objectOperand.orders = [];
                        objectOperand.addOrder(orders);
                    }
                    return objectOperand;
                }
                case "groupBy": {
                    // TODO: queryable end with group by. Orders.groupBy(o => o.OrderDate).toArray();
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    selectOperand.includes = [];
                    const parentRelation = objectOperand.parentRelation;
                    const selectorFn = expression.params[0] as FunctionExpression<TType, TResult>;
                    const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                    this.scopeParameters.add(selectorFn.params[0].name, selectOperand.getVisitParam());
                    const selectExp = this.visit(selectorFn, visitParam);
                    this.scopeParameters.remove(selectorFn.params[0].name);
                    param.commandExpression = visitParam.commandExpression;

                    // 123
                    if (selectExp instanceof SelectExpression) {
                        throw new Error(`Queryable<${objectOperand.type}>.groupBy did not support selector with array or queryable or enumerable return value.`);
                    }

                    let groupColumns: IColumnExpression[] = [];
                    let key = selectExp;
                    let selectColumns: IColumnExpression[] = [];
                    if ((selectExp as IEntityExpression).primaryColumns) {
                        const entityExp = selectExp as IEntityExpression;
                        groupColumns.push(...(Array.from(entityExp.select.parentRelation.relations.keys())));
                        // remove relation
                        entityExp.select.parentRelation.parent.joins.remove(entityExp.select.parentRelation as any);
                        // add include
                        selectOperand.addInclude("key", entityExp.select, entityExp.select.parentRelation.relations, "one");
                    }
                    else if (selectExp instanceof ObjectValueExpression) {
                        this.visitObjectGroup(selectOperand, selectExp, groupColumns, selectColumns, "key");
                    }
                    else if ((selectExp as IColumnExpression).entity) {
                        const column = (selectExp as IColumnExpression).clone();
                        column.propertyName = "key";
                        groupColumns.push(column);
                        selectColumns.push(column);
                        key = column;
                    }
                    else {
                        const column = new ComputedColumnExpression(selectOperand.entity, selectExp, "key");
                        groupColumns.push(column);
                        selectColumns.push(column);
                        key = column;
                    }

                    const groupByExp = new GroupByExpression(selectOperand, groupColumns, key, true);
                    groupByExp.selects = selectColumns.slice(0);
                    if (parentRelation) {
                        parentRelation.child = groupByExp;
                        groupByExp.parentRelation = parentRelation;
                    }
                    else {
                        param.commandExpression = groupByExp;
                    }
                    return groupByExp;
                }
                case "skip":
                case "take": {
                    throw new Error(`${param.scope} did not support ${expression.methodName}`);
                }
                case "distinct": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    objectOperand.distinct = true;
                    objectOperand.isAggregate = param.scope === "queryable";
                    return objectOperand;
                }
                case "include": {
                    for (const paramFn of expression.params) {
                        const selectorFn = paramFn as FunctionExpression<TType, TResult>;
                        this.scopeParameters.add(selectorFn.params[0].name, objectOperand.getVisitParam());
                        let visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: "include" };
                        this.visit(selectorFn, visitParam);
                        this.scopeParameters.remove(selectorFn.params[0].name);
                    }
                    return objectOperand;
                }
                case "toArray": {
                    return objectOperand;
                }
                case "count": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    const countExp = new MethodCallExpression(objectOperand, expression.methodName, [], Number);
                    if (param.scope === "queryable") {
                        // call from queryable
                        const column = new ComputedColumnExpression(objectOperand.entity, countExp, this.newAlias("column"));
                        objectOperand.selects = [column];
                        objectOperand.itemExpression = column;
                        objectOperand.isAggregate = true;
                        return objectOperand;
                    }
                    else if (selectOperand instanceof GroupedExpression) {
                        return countExp;
                    }
                    else {
                        // any is used on related entity. change query to groupby.
                        const column = new ComputedColumnExpression(objectOperand.entity, countExp, this.newAlias("column"));
                        const groupBy = [];
                        const keyObject: any = {};
                        for (const [, entityCol] of selectOperand.parentRelation.relations) {
                            groupBy.push(entityCol);
                            keyObject[entityCol.propertyName] = entityCol;
                        }
                        const groupExp = new GroupByExpression(selectOperand, groupBy, new ObjectValueExpression(keyObject));
                        const flagColumn = column;
                        groupExp.selects.push(flagColumn);
                        return flagColumn;
                    }
                }
                case "sum":
                case "avg":
                case "max":
                case "min": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    if (expression.params.length > 0) {
                        const selectorFn = expression.params[0] as FunctionExpression;
                        this.scopeParameters.add(selectorFn.params[0].name, selectOperand.getVisitParam());
                        const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                        const selectExpression: SelectExpression = this.visit(new MethodCallExpression(objectOperand, "select", [selectorFn]), visitParam) as any;
                        this.scopeParameters.remove(selectorFn.params[0].name);
                        param.commandExpression = visitParam.commandExpression;

                        if (!isValueType(selectExpression.itemType))
                            throw new Error(`Queryable<${selectOperand.type.name}> required select with basic type return value.`);

                        selectOperand = selectExpression;
                    }

                    const aggregateExp = new MethodCallExpression(selectOperand, expression.methodName, selectOperand.selects.select(o => {
                        if (o instanceof ComputedColumnExpression)
                            return o.expression;
                        return o;
                    }).toArray(), Number);
                    if (param.scope === "queryable") {
                        // call from queryable
                        const column = new ComputedColumnExpression(selectOperand.entity, aggregateExp, this.newAlias("column"));
                        objectOperand.selects = [column];
                        objectOperand.isAggregate = true;
                        return objectOperand;
                    }
                    else if (selectOperand instanceof GroupedExpression) {
                        return aggregateExp;
                    }
                    else {
                        // any is used on related entity. change query to groupby.
                        const groupBy = [];
                        const keyObject: any = {};
                        for (const [, entityCol] of selectOperand.parentRelation.relations) {
                            groupBy.push(entityCol);
                            keyObject[entityCol.propertyName] = entityCol;
                        }
                        const groupExp = new GroupByExpression(selectOperand, groupBy, new ObjectValueExpression(keyObject));
                        const column = new ComputedColumnExpression(selectOperand.entity, aggregateExp, this.newAlias("column"));
                        groupExp.selects.push(column);
                        return column;
                    }
                }
                case "all":
                case "any": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    const isAny = expression.methodName === "any";
                    if (expression.params.length > 0) {
                        let predicateFn = expression.params[0] as FunctionExpression;
                        if (!isAny)
                            predicateFn.body = new NotExpression(predicateFn.body);
                        const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                        this.visit(new MethodCallExpression(selectOperand, "where", [predicateFn]), visitParam);
                    }
                    const anyExp = new ValueExpression(isAny);
                    if (param.scope === "queryable") {
                        // call from queryable
                        const column = new ComputedColumnExpression(objectOperand.entity, anyExp, this.newAlias("column"));
                        objectOperand.selects = [column];
                        objectOperand.paging.take = 1;
                        objectOperand.isAggregate = true;
                        return objectOperand;
                    }
                    else if (selectOperand instanceof GroupedExpression) {
                        return anyExp;
                    }
                    else {
                        // any is used on related entity. change query to groupby.
                        const groupBy = [];
                        const keyObject: any = {};
                        for (const [, entityCol] of selectOperand.parentRelation.relations) {
                            groupBy.push(entityCol);
                            keyObject[entityCol.propertyName] = entityCol;
                        }
                        const groupExp = new GroupByExpression(selectOperand, groupBy, new ObjectValueExpression(keyObject));
                        const column = new ComputedColumnExpression(objectOperand.entity, anyExp, this.newAlias("column"));
                        groupExp.selects.push(column);
                        return new (isAny ? NotEqualExpression : EqualExpression)(column, new ValueExpression(null));
                    }
                }
                case "contains": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    const item = expression.params[0];
                    let andExp: IExpression<boolean>;
                    if (objectOperand.itemType === objectOperand.entity.type) {
                        for (const primaryCol of objectOperand.entity.primaryColumns) {
                            const d = new EqualExpression(primaryCol, new MemberAccessExpression(item, primaryCol.propertyName));
                            andExp = andExp ? new AndExpression(andExp, d) : d;
                        }
                    }
                    else {
                        andExp = new EqualExpression(objectOperand.selects.first(), item);
                    }
                    if (param.scope === "queryable") {
                        objectOperand.addWhere(andExp);
                        const column = new ComputedColumnExpression(objectOperand.entity, new ValueExpression(true), this.newAlias("column"));
                        objectOperand.selects = [column];
                        objectOperand.paging.take = 1;
                        objectOperand.isAggregate = true;
                        return objectOperand;
                    }
                    return andExp;
                }
                case "first": {
                    if (param.scope !== "queryable")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    if (expression.params.length > 0) {
                        const predicateFn = expression.params[0] as FunctionExpression;
                        const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                        this.visit(new MethodCallExpression(selectOperand, "where" as any, [predicateFn]), visitParam);
                        param.commandExpression = visitParam.commandExpression;
                    }
                    selectOperand.paging.take = 1;
                    return selectOperand.entity;
                }
                case "innerJoin":
                case "leftJoin":
                case "rightJoin":
                case "fullJoin": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    const parentRelation = objectOperand.parentRelation;
                    const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: "join" };
                    const childSelectOperand: SelectExpression = this.visit(expression.params[0], visitParam) as any;
                    const childVisitParam: IQueryVisitParameter = { commandExpression: childSelectOperand, scope: "join" };

                    const parentKeySelector = expression.params[1] as FunctionExpression;
                    this.scopeParameters.add(parentKeySelector.params[0].name, selectOperand.getVisitParam());
                    let parentKey = this.visit(parentKeySelector, visitParam);
                    this.scopeParameters.remove(parentKeySelector.params[0].name);

                    const childKeySelector = expression.params[2] as FunctionExpression;
                    this.scopeParameters.add(childKeySelector.params[0].name, childSelectOperand.getVisitParam());
                    let childKey = this.visit(childKeySelector, childVisitParam);
                    this.scopeParameters.remove(childKeySelector.params[0].name);

                    let joinRelationMap = new Map<IColumnExpression<any, any>, IColumnExpression<any, any>>();

                    if (parentKey.type !== childKey.type) {
                        throw new Error(`Key type not match`);
                    }
                    else if ((parentKey as IEntityExpression).primaryColumns) {
                        const parentEntity = parentKey as IEntityExpression;
                        const childEntity = childKey as IEntityExpression;
                        for (const parentCol of parentEntity.primaryColumns) {
                            const childCol = childEntity.primaryColumns.first((c) => c.propertyName === parentCol.propertyName);
                            joinRelationMap.set(parentCol, childCol);
                        }
                    }
                    else {
                        if (!(childKey as IColumnExpression).entity)
                            childKey = new ComputedColumnExpression(childSelectOperand.entity, childKey, this.newAlias());
                        if (!(parentKey as IColumnExpression).entity)
                            parentKey = new ComputedColumnExpression(selectOperand.entity, parentKey, this.newAlias());
                        joinRelationMap.set(parentKey as any, childKey as any);
                    }

                    let jointType: JoinType;
                    switch (expression.methodName) {
                        case "leftJoin":
                            jointType = JoinType.LEFT;
                            break;
                        case "rightJoin":
                            jointType = JoinType.RIGHT;
                            break;
                        case "fullJoin":
                            jointType = JoinType.FULL;
                            break;
                        default:
                            jointType = JoinType.INNER;
                            break;
                    }

                    selectOperand.addJoinRelation(childSelectOperand, joinRelationMap, jointType);

                    const resultVisitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: "join" };
                    const resultSelector = expression.params[3] as FunctionExpression;
                    this.scopeParameters.add(resultSelector.params[1].name, childSelectOperand.getVisitParam());
                    this.visit(new MethodCallExpression(selectOperand, "select", [resultSelector]), resultVisitParam);
                    this.scopeParameters.remove(resultSelector.params[1].name);
                    if (parentRelation) {
                        parentRelation.child = selectOperand;
                        selectOperand.parentRelation = parentRelation;
                    }
                    else {
                        param.commandExpression = selectOperand;
                    }

                    return selectOperand;
                }
                case "union":
                case "intersect":
                case "except": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    const parentRelation = objectOperand.parentRelation;
                    const visitParam: IQueryVisitParameter = { commandExpression: selectOperand, scope: expression.methodName };
                    const childSelectOperand: SelectExpression = this.visit(expression.params[0], visitParam) as any;
                    param.commandExpression = visitParam.commandExpression;

                    let entityExp: IEntityExpression;
                    switch (expression.methodName) {
                        case "union":
                            const isUnionAll = expression.params.length <= 1 ? false : expression.params[1].execute();
                            entityExp = new UnionExpression(selectOperand, childSelectOperand, isUnionAll);
                            break;
                        case "intersect":
                            entityExp = new IntersectExpression(selectOperand, childSelectOperand);
                            break;
                        case "except":
                            entityExp = new ExceptExpression(selectOperand, childSelectOperand);
                            break;
                    }
                    selectOperand = new SelectExpression(entityExp);
                    if (parentRelation) {
                        parentRelation.child = selectOperand;
                        selectOperand.parentRelation = parentRelation;
                    }
                    else {
                        param.commandExpression = selectOperand;
                    }
                    return selectOperand;
                }
                case "pivot": {
                    if (param.scope === "include")
                        throw new Error(`${param.scope} did not support ${expression.methodName}`);

                    const parentRelation = objectOperand.parentRelation;

                    const dimensions = expression.params[0] as FunctionExpression<TType, any>;
                    const metrics = expression.params[1] as FunctionExpression<TType, any>;

                    // groupby
                    let visitParam: IQueryVisitParameter = { commandExpression: objectOperand, scope: expression.methodName };
                    const groupExp: GroupByExpression = this.visit(new MethodCallExpression(objectOperand, "groupBy", [dimensions]), visitParam) as any;
                    param.commandExpression = visitParam.commandExpression;

                    const dObject = (dimensions.body as ObjectValueExpression<any>).object;
                    const mObject = (metrics.body as ObjectValueExpression<any>).object;
                    const dmObject: { [key: string]: IExpression } = {};
                    for (const prop in dObject)
                        dmObject[prop] = dObject[prop];
                    for (const prop in mObject)
                        dmObject[prop] = dObject[prop];

                    // select
                    const selectorFn = new FunctionExpression(new ObjectValueExpression(dmObject), metrics.params);
                    this.scopeParameters.add(dimensions.params[0].name, groupExp.key);
                    this.scopeParameters.add(selectorFn.params[0].name, groupExp.getVisitParam());
                    visitParam = { commandExpression: groupExp, scope: expression.methodName };
                    const selectExpression: SelectExpression = this.visit(new MethodCallExpression(groupExp, "select", [selectorFn]), visitParam) as any;
                    this.scopeParameters.remove(selectorFn.params[0].name);
                    this.scopeParameters.remove(dimensions.params[0].name);
                    param.commandExpression = visitParam.commandExpression;
                    selectOperand = selectExpression;

                    if (parentRelation) {
                        parentRelation.child = selectOperand;
                        selectOperand.parentRelation = parentRelation;
                    }
                    else {
                        param.commandExpression = selectOperand;
                    }
                    return selectOperand;
                }
            }
            throw new Error(`${expression.methodName} not supported on expression`);
        }
        else {
            expression.params = expression.params.select(o => this.visit(o, { commandExpression: param.commandExpression })).toArray();

            const isObjectOperandSafe = isSafe(objectOperand, this);
            const isExpressionSafe = isObjectOperandSafe && expression.params.all(o => isSafe(o, this));

            let translator;
            if (objectOperand instanceof ValueExpression) {
                translator = this.queryBuilder.resolveTranslator(objectOperand.value, expression.methodName);

                if (translator && !(translator.preferApp && isExpressionSafe))
                    return expression;
            }
            if (!translator) {
                translator = this.queryBuilder.resolveTranslator(objectOperand.type.prototype, expression.methodName);
                if (translator && !(translator.preferApp && isExpressionSafe)) {
                    return expression;
                }
            }

            // Execute in app if all parameter is available.
            if (isExpressionSafe) {
                let hasParam = false;
                [expression.objectOperand, hasParam] = extract(expression.objectOperand, this);
                expression.params = expression.params.select(o => {
                    const [res, isParam] = extract(o, this);
                    hasParam = hasParam || isParam;
                    return res;
                }).toArray();
                if (hasParam) {
                    const result = this.createParamBuilderItem(expression);
                    return result;
                }

                return new ValueExpression(expression.execute());
            }

            const oriObjectOperand = isObjectOperandSafe ? extractValue(objectOperand, this) : objectOperand;
            const methodFn: () => any = oriObjectOperand instanceof ValueExpression ? oriObjectOperand.value[expression.methodName] : objectOperand.type.prototype[expression.methodName];
            if (methodFn && !isNativeFunction(methodFn)) {
                // try convert user defined method to a FunctionExpression and built it as a query.
                const methodExp = ExpressionBuilder.parse(methodFn);
                for (let i = 0; i < expression.params.length; i++) {
                    this.scopeParameters.add(methodExp.params[i].name, expression.params[i]);
                }
                const result = this.visitFunction(methodExp, { commandExpression: param.commandExpression });
                for (let i = 0; i < expression.params.length; i++) {
                    this.scopeParameters.remove(methodExp.params[i].name);
                }
                return result;
            }
        }
        throw new Error(`${expression.methodName} not supported.`);
    }
    protected visitFunctionCall<T>(expression: FunctionCallExpression<T>, param: IQueryVisitParameter): IExpression {
        expression.fnExpression = this.visit(expression.fnExpression, param);
        expression.params = expression.params.select((o) => this.visit(o, param)).toArray();

        const fnExp = expression.fnExpression = extractValue(expression.fnExpression, this) as ValueExpression<() => any>;
        const fn = fnExp.value;

        const isExpressionSafe = expression.params.all(o => isSafe(o, this));

        const translator = this.queryBuilder.resolveTranslator(fn);
        if (translator && !(translator.preferApp && isExpressionSafe))
            return expression;

        // Execute function in application if all it's parameters available in application.
        if (isExpressionSafe) {
            let hasParam = false;
            expression.params = expression.params.select(o => {
                const [res, isParam] = extract(o, this);
                hasParam = hasParam || isParam;
                return res;
            }).toArray();
            if (hasParam) {
                const result = this.createParamBuilderItem(expression);
                return result;
            }

            return new ValueExpression(expression.execute());
        }

        // Try convert function as Expression
        if (!isNativeFunction(fn)) {
            const functionExp = ExpressionBuilder.parse(fn, this.userParameters);
            for (let i = 0; i < functionExp.params.length; i++) {
                this.scopeParameters.add(functionExp.params[i].name, expression.params[i]);
            }
            const result = this.visit(functionExp, { commandExpression: param.commandExpression });
            for (let i = 0; i < functionExp.params.length; i++) {
                this.scopeParameters.remove(functionExp.params[i].name);
            }
            return result;
        }
        return expression;
    }
    protected visitBinaryOperator(expression: IBinaryOperatorExpression, param: IQueryVisitParameter): IExpression {
        expression.leftOperand = this.visit(expression.leftOperand, param);
        expression.rightOperand = this.visit(expression.rightOperand, param);

        if (expression.leftOperand instanceof TernaryExpression) {
            const ternaryExp = expression.leftOperand as TernaryExpression;
            const falseOperand = expression.clone();
            falseOperand.leftOperand = ternaryExp.falseResultOperand;
            const trueOperand = expression.clone();
            trueOperand.leftOperand = ternaryExp.trueResultOperand;
            return new TernaryExpression(ternaryExp.logicalOperand, this.visit(trueOperand, param), this.visit(falseOperand, param));
        }
        else if (expression.rightOperand instanceof TernaryExpression) {
            const ternaryExp = expression.rightOperand as TernaryExpression;
            const falseOperand = expression.clone();
            falseOperand.rightOperand = ternaryExp.falseResultOperand;
            const trueOperand = expression.clone();
            trueOperand.rightOperand = ternaryExp.trueResultOperand;
            return new TernaryExpression(ternaryExp.logicalOperand, this.visit(trueOperand, param), this.visit(falseOperand, param));
        }

        return expression;
    }
    protected visitUnaryOperator(expression: IUnaryOperatorExpression, param: IQueryVisitParameter): IExpression {
        expression.operand = this.visit(expression.operand, param);
        if (expression.operand instanceof TernaryExpression) {
            const ternaryExp = expression.operand as TernaryExpression;
            const falseOperand = expression.clone();
            falseOperand.operand = ternaryExp.falseResultOperand;
            const trueOperand = expression.clone();
            trueOperand.operand = ternaryExp.trueResultOperand;
            return new TernaryExpression(ternaryExp.logicalOperand, trueOperand, falseOperand);
        }
        return expression;
    }
    protected visitTernaryOperator(expression: TernaryExpression<any>, param: IQueryVisitParameter): IExpression {
        expression.logicalOperand = this.visit(expression.logicalOperand, param);
        expression.trueResultOperand = this.visit(expression.trueResultOperand, param);
        expression.falseResultOperand = this.visit(expression.falseResultOperand, param);
        return expression;
    }
    protected visitObjectLiteral<T extends { [Key: string]: IExpression } = any>(expression: ObjectValueExpression<T>, param: IQueryVisitParameter) {
        const objectValue: any = {};
        for (const prop in expression.object) {
            objectValue[prop] = this.visit(expression.object[prop], { commandExpression: param.commandExpression });
        }
        expression.object = objectValue;
        return expression;
    }

    //#endregion
}
