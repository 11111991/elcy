import {
    AdditionExpression, AndExpression, ArrayValueExpression, BitwiseAndExpression,
    BitwiseNotExpression, BitwiseOrExpression, BitwiseSignedRightShiftExpression,
    BitwiseXorExpression, BitwiseZeroLeftShiftExpression, BitwiseZeroRightShiftExpression,
    DivisionExpression, EqualExpression, FunctionCallExpression, FunctionExpression,
    GreaterEqualExpression, GreaterThanExpression, IExpression,
    InstanceofExpression, LeftDecrementExpression,
    LeftIncrementExpression, LessEqualExpression, LessThanExpression, MemberAccessExpression,
    MethodCallExpression, NotEqualExpression, NotExpression, ObjectValueExpression, OrExpression,
    ParameterExpression, RightDecrementExpression, RightIncrementExpression,
    StrictEqualExpression, StrictNotEqualExpression, SubtractionExpression, TernaryExpression,
    TimesExpression, TypeofExpression, ValueExpression
} from "../ExpressionBuilder/Expression";
import { ModulusExpression } from "../ExpressionBuilder/Expression/ModulusExpression";
import { ExpressionFactory } from "../ExpressionBuilder/ExpressionFactory";
import { ExpressionTransformer } from "../ExpressionBuilder/ExpressionTransformer";
import { TransformerParameter } from "../ExpressionBuilder/TransformerParameter";
import { NamingStrategy } from "./NamingStrategy";
import { EntityExpression } from "./Queryable/QueryExpression/EntityExpression";
import { GroupByExpression } from "./Queryable/QueryExpression/GroupByExpression";
import { IColumnExpression } from "./Queryable/QueryExpression/IColumnExpression";
import { ColumnExpression, ComputedColumnExpression, ExceptExpression, IEntityExpression, IntersectExpression, ProjectionEntityExpression } from "./Queryable/QueryExpression/index";
import { JoinEntityExpression } from "./Queryable/QueryExpression/JoinEntityExpression";
import { SelectExpression } from "./Queryable/QueryExpression/SelectExpression";
import { SqlFunctionCallExpression } from "./Queryable/QueryExpression/SqlFunctionCallExpression";
import { UnionExpression } from "./Queryable/QueryExpression/UnionExpression";
import { IQueryVisitParameter, QueryExpressionVisitor } from "./QueryExpressionVisitor";

export abstract class QueryBuilder extends ExpressionTransformer {
    public get parameters(): TransformerParameter {
        return this.queryVisitor.parameters;
    }
    public namingStrategy: NamingStrategy = new NamingStrategy();
    protected queryVisitor: QueryExpressionVisitor = new QueryExpressionVisitor(this.namingStrategy);
    protected indent = 0;

    public newAlias(type?: "entity" | "column") {
        return this.queryVisitor.newAlias(type);
    }
    public escape(identity: string) {
        if (this.namingStrategy.enableEscape)
            return "[" + identity + "]";
        else
            return identity;
    }
    /**
     * Expression visitor
     */
    public visit(expression: IExpression, param: IQueryVisitParameter): IExpression {
        return this.queryVisitor.visit(expression, param);
    }

    public getContainsString(expression: SelectExpression) {
        return "SELECT EXISTS (" + this.getExpressionString(expression) + ")";
    }

    public getExpressionString<T = any>(expression: IExpression<T>): string {
        if (expression instanceof SelectExpression) {
            return this.getSelectQueryString(expression);
        }
        else if (expression instanceof ColumnExpression || expression instanceof ComputedColumnExpression) {
            return this.getColumnString(expression);
        }
        else if (expression instanceof EntityExpression || expression instanceof JoinEntityExpression || expression instanceof ProjectionEntityExpression) {
            return this.getEntityQueryString(expression);
        }
        else {
            let result = "";
            switch (expression.constructor) {
                case SqlFunctionCallExpression:
                    result = this.getSqlFunctionCallExpressionString(expression as any);
                    break;
                case MemberAccessExpression:
                    result = this.getMemberAccessExpressionString(expression as any);
                    break;
                case MethodCallExpression:
                    result = this.getMethodCallExpressionString(expression as any);
                    break;
                case FunctionCallExpression:
                    result = this.getFunctionCallExpressionString(expression as any);
                    break;
                case BitwiseNotExpression:
                    result = this.getBitwiseNotExpressionString(expression as any);
                    break;
                case LeftDecrementExpression:
                    result = this.getLeftDecrementExpressionString(expression as any);
                    break;
                case LeftIncrementExpression:
                    result = this.getLeftIncrementExpressionString(expression as any);
                    break;
                case NotExpression:
                    result = this.getNotExpressionString(expression as any);
                    break;
                case RightDecrementExpression:
                    result = this.getRightDecrementExpressionString(expression as any);
                    break;
                case RightIncrementExpression:
                    result = this.getRightIncrementExpressionString(expression as any);
                    break;
                case TypeofExpression:
                    result = this.getTypeofExpressionString(expression as any);
                    break;
                case AdditionExpression:
                    result = this.getAdditionExpressionString(expression as any);
                    break;
                case AndExpression:
                    result = this.getAndExpressionString(expression as any);
                    break;
                case BitwiseAndExpression:
                    result = this.getBitwiseAndExpressionString(expression as any);
                    break;
                case BitwiseOrExpression:
                    result = this.getBitwiseOrExpressionString(expression as any);
                    break;
                case BitwiseSignedRightShiftExpression:
                    result = this.getBitwiseSignedRightShiftExpressionString(expression as any);
                    break;
                case BitwiseXorExpression:
                    result = this.getBitwiseXorExpressionString(expression as any);
                    break;
                case BitwiseZeroLeftShiftExpression:
                    result = this.getBitwiseZeroLeftShiftExpressionString(expression as any);
                    break;
                case BitwiseZeroRightShiftExpression:
                    result = this.getBitwiseZeroRightShiftExpressionString(expression as any);
                    break;
                case DivisionExpression:
                    result = this.getDivisionExpressionString(expression as any);
                    break;
                case EqualExpression:
                    result = this.getEqualExpressionString(expression as any);
                    break;
                case GreaterEqualExpression:
                    result = this.getGreaterEqualExpressionString(expression as any);
                    break;
                case GreaterThanExpression:
                    result = this.getGreaterThanExpressionString(expression as any);
                    break;
                case InstanceofExpression:
                    result = this.getInstanceofExpressionString(expression as any);
                    break;
                case LessEqualExpression:
                    result = this.getLessEqualExpressionString(expression as any);
                    break;
                case LessThanExpression:
                    result = this.getLessThanExpressionString(expression as any);
                    break;
                case NotEqualExpression:
                    result = this.getNotEqualExpressionString(expression as any);
                    break;
                case OrExpression:
                    result = this.getOrExpressionString(expression as any);
                    break;
                case StrictEqualExpression:
                    result = this.getStrictEqualExpressionString(expression as any);
                    break;
                case StrictNotEqualExpression:
                    result = this.getStrictNotEqualExpressionString(expression as any);
                    break;
                case SubtractionExpression:
                    result = this.getSubtractionExpressionString(expression as any);
                    break;
                case TimesExpression:
                    result = this.getTimesExpressionString(expression as any);
                    break;
                case TernaryExpression:
                    result = this.getTernaryExpressionString(expression as any);
                    break;
                case ObjectValueExpression:
                    result = this.getObjectValueExpressionString(expression as any);
                    break;
                case ArrayValueExpression:
                    result = this.getArrayValueExpressionString(expression as any);
                    break;
                case ParameterExpression:
                    result = this.getParameterExpressionString(expression as any);
                    break;
                case ValueExpression:
                    result = this.getValueExpressionString(expression as any);
                    break;
                // Possibly not used
                case FunctionExpression:
                    result = this.getFunctionExpressionString(expression as any);
                    break;
            }
            return "(" + result + ")";
        }
    }
    protected getColumnString(column: IColumnExpression, emitAlias = true) {
        if (column instanceof ComputedColumnExpression) {
            return this.getExpressionString(column.expression) + (emitAlias ? " AS " + this.escape(column.alias) : "");
        }
        return this.escape(column.entity.alias) + "." + this.escape(column.alias ? column.alias : column.property);
    }
    protected getSelectQueryString(select: SelectExpression): string {
        return "SELECT" + (select.distinct ? " DISTINCT" : "") + (select.paging.take && select.paging.take > 0 ? " TOP " + select.paging.take : "") +
            " " + select.columns.select((o) => o.toString(this)).toArray().join("," + this.newLine(this.indent + 1)) +
            this.newLine() + "FROM " + this.getEntityQueryString(select.entity) +
            (select.where ? this.newLine() + "WHERE " + this.getExpressionString(select.where) : "") +
            ((select instanceof GroupByExpression) && select.groupBy ? this.newLine() + "GROUP BY " + select.groupBy.select((o) => this.getColumnString(o, false)).toArray().join(", ") : "") +
            (select.orders.length > 0 ? this.newLine() + "ORDER BY " + select.orders.select((c) => this.getExpressionString(c.column) + " " + c.direction).toArray().join(", ") : "");
    }
    protected newLine(indent = this.indent) {
        return "\n" + (Array(indent + 1).join("\t"));
    }
    protected getEntityQueryString(entity: IEntityExpression): string {
        if (entity instanceof IntersectExpression) {
            return "(" + this.newLine(++this.indent) + "(" + this.newLine(++this.indent) + this.getSelectQueryString(entity.select) + this.newLine(--this.indent) + ")" +
                this.newLine() + "INTERSECT" +
                this.newLine() + "(" + this.newLine(++this.indent) + this.getSelectQueryString(entity.select2) + this.newLine(--this.indent) + ")" + this.newLine(--this.indent) + ") AS " + this.escape(entity.alias);
        }
        else if (entity instanceof UnionExpression) {
            return "(" + this.newLine(++this.indent) + "(" + this.newLine(++this.indent) + this.getSelectQueryString(entity.select) + this.newLine(--this.indent) + ")" +
                this.newLine() + "UNION" + (entity.isUnionAll ? " ALL" : "") +
                this.newLine() + "(" + this.newLine(++this.indent) + this.getSelectQueryString(entity.select2) + this.newLine(--this.indent) + ")" + this.newLine(--this.indent) + ") AS " + this.escape(entity.alias);
        }
        else if (entity instanceof ExceptExpression) {
            return "(" + this.newLine(++this.indent) + "(" + this.newLine(++this.indent) + this.getSelectQueryString(entity.select) + this.newLine(--this.indent) + ")" +
                this.newLine() + "EXCEPT" +
                this.newLine() + "(" + this.newLine(++this.indent) + this.getSelectQueryString(entity.select2) + this.newLine(--this.indent) + ")" + this.newLine(--this.indent) + ") AS " + this.escape(entity.alias);
        }
        else if (entity instanceof ProjectionEntityExpression)
            return "(" + this.newLine(++this.indent) + this.getSelectQueryString(entity.select) + this.newLine(--this.indent) + ") AS " + this.escape(entity.alias);
        else if (entity instanceof JoinEntityExpression)
            return this.getEntityQueryString(entity.parentEntity) +
                this.newLine() + entity.relations.select((o) => o.type + " JOIN " + this.getEntityQueryString(o.child) +
                    this.newLine(this.indent + 1) + "ON " + o.relationMaps.select((r) => this.getColumnString(r.parentColumn) + " = " + this.getColumnString(r.childColumn)).toArray().join(" AND ")).toArray().join(this.newLine());
        return this.escape(entity.name) + (entity.alias ? " AS " + this.escape(entity.alias) : "");
    }
    protected getFunctionCallExpressionString(expression: FunctionCallExpression<any>): string {
        switch (expression.functionFn) {
            case parseInt:
                return "CAST(" + this.getExpressionString(expression.params[0]) + " AS INT)";
            case parseFloat:
                return "CAST(" + this.getExpressionString(expression.params[0]) + " AS FLOAT)";
            case isNaN:
                return "ISNUMERIC(" + this.getExpressionString(expression.params[0]) + ") = 0";
            case isFinite:
            case decodeURI:
            case decodeURIComponent:
            case encodeURI:
            case encodeURIComponent:
                throw new Error(`${expression.functionName} not supported in linq to sql.`);
        }
        // TODO: ToExpression must support this parameter
        const fnExpression = ExpressionFactory.prototype.ToExpression(expression.functionFn, expression.params[0].type);
        for (let i = 0; i < fnExpression.params.length; i++) {
            const param = fnExpression.params[i];
            this.parameters.add(param.name, expression.params[i]);
        }
        const result = this.getExpressionString(fnExpression.body);
        return result;
    }
    protected getSqlFunctionCallExpressionString(expression: SqlFunctionCallExpression<any>): string {
        return expression.functionName + "(" + expression.params.select((o) => this.getExpressionString(o)).toArray().join(", ") + ")";
    }
    protected getMemberAccessExpressionString(expression: MemberAccessExpression<any, any>): string {
        switch (expression.objectOperand.type) {
            case String:
                switch (expression.memberName) {
                    case "length":
                        return "LEN(" + this.getExpressionString(expression.objectOperand) + ")";
                }
                break;
            case Object:
                if (expression instanceof ValueExpression) {
                    switch (expression.value) {
                        case Math:
                            switch (expression.memberName) {
                                case "E":
                                    return "EXP(1)";
                                case "LN10":
                                    return "LOG(10)";
                                case "LN2":
                                    return "LOG(2)";
                                case "LOG10E":
                                    return "LOG10(EXP(1))";
                                case "LOG2E":
                                    return "LOG(EXP(1), 2)";
                                case "PI":
                                    return "PI()";
                                case "SQRT1_2":
                                    return "SQRT(0.5)";
                                case "SQRT2":
                                    return "SQRT(2)";
                            }
                            break;
                    }
                }
                break;
        }
        throw new Error(`${expression.memberName} not supported.`);
    }
    protected getMethodCallExpressionString<TType, KProp extends keyof TType, TResult = any>(expression: MethodCallExpression<TType, KProp, TResult>): string {
        switch (expression.objectOperand.type as any) {
            case String:
                switch (expression.methodName) {
                    case "charAt":
                        return "SUBSTRING(" + this.getExpressionString(expression.objectOperand) + ", " + this.getExpressionString(expression.params[0]) + ", 1)";
                    case "charCodeAt":
                        return "UNICODE(SUBSTRING(" + this.getExpressionString(expression.objectOperand) + ", " + this.getExpressionString(expression.params[0]) + ", 1))";
                    case "concat":
                        return "CONCAT(" + this.getExpressionString(expression.objectOperand) + ", " + expression.params.select((p) => this.getExpressionString(p)).toArray().join(", ") + ")";
                    case "endsWith":
                        return "(" + this.getExpressionString(expression.objectOperand) + " LIKE CONCAT(" + this.getString("%") + ", " + this.getExpressionString(expression.params[0]) + "))";
                    case "includes":
                        if (expression.params.length > 1)
                            return "(" + this.getExpressionString(expression.params[0]) + " + RIGHT(" + this.getExpressionString(expression.objectOperand) + ", (LEN(" + this.getExpressionString(expression.objectOperand) + ") - " + this.getExpressionString(expression.params[0]) + "))))";
                        return "(" + this.getExpressionString(expression.objectOperand) + " LIKE CONCAT(" + this.getString("%") + ", " + this.getExpressionString(expression.params[0]) + ", " + this.getString("%") + ")";
                    case "indexOf":
                        return "(CHARINDEX(" + this.getExpressionString(expression.params[0]) + ", " + this.getExpressionString(expression.objectOperand) +
                            (expression.params.length > 1 ? ", " + this.getExpressionString(expression.params[1]) : "") +
                            ") - 1)";
                    case "lastIndexOf":
                        return "(LEN(" + this.getExpressionString(expression.objectOperand) + ") - CHARINDEX(" + this.getExpressionString(expression.params[0]) + ", REVERSE(" + this.getExpressionString(expression.objectOperand) + ")" +
                            (expression.params.length > 1 ? ", " + this.getExpressionString(expression.params[1]) : "") + "))";
                    case "like":
                        return "(" + this.getExpressionString(expression.objectOperand) + " LIKE " + this.getExpressionString(expression.params[0]) + ")";
                    case "repeat":
                        return "REPLICATE(" + this.getExpressionString(expression.objectOperand) + ", " + this.getExpressionString(expression.params[0]) + ")";
                    case "replace":
                        // TODO throw error on regex.
                        return "REPLACE(" + this.getExpressionString(expression.objectOperand) + ", " + this.getExpressionString(expression.params[0]) + ", " + this.getExpressionString(expression.params[1]) + ")";
                    case "split":
                        // only single character split.
                        return "STRING_SPLIT(" + this.getExpressionString(expression.objectOperand) + ", " + this.getExpressionString(expression.params[0]) + ")";
                    case "startsWith":
                        return "(" + this.getExpressionString(expression.objectOperand) + " LIKE CONCAT(" + this.getExpressionString(expression.params[0]) + ", " + this.getString("%") + "))";
                    case "substr":
                        return "SUBSTRING(" + this.getExpressionString(expression.objectOperand) + ", " +
                            "(" + this.getExpressionString(expression.params[0]) + " + 1), " +
                            (expression.params.length > 1 ? this.getExpressionString(expression.params[1]) : "8000") + ")";
                    case "substring":
                        return "SUBSTRING(" + this.getExpressionString(expression.objectOperand) + ", " +
                            "(" + this.getExpressionString(expression.params[0]) + " + 1), " +
                            (expression.params.length > 1 ? "(" + this.getExpressionString(expression.params[1]) + " - " + this.getExpressionString(expression.params[0]) + ")" : "8000") + ")";
                    case "toLowerCase":
                    case "toLocaleLowerCase":
                        return "LOWER(" + this.getExpressionString(expression.objectOperand) + ")";
                    case "toUpperCase":
                    case "toLocaleUpperCase":
                        return "UPPER(" + this.getExpressionString(expression.objectOperand) + ")";
                    case "toString":
                    case "valueOf":
                        return this.getExpressionString(expression.objectOperand);
                    case "trim":
                        return "RTRIM(LTRIM(" + this.getExpressionString(expression.objectOperand) + "))";
                    case "localeCompare":
                    case "match":
                    case "normalize":
                    case "padEnd":
                    case "padStart":
                    case "search":
                    case "slice":
                        throw new Error(`method "String.${expression.methodName}" not supported in linq to sql.`);
                }
                break;
            case Number:
                switch (expression.methodName) {
                    case "isFinite":
                    case "isInteger":
                    case "isNaN":
                    case "isSafeInteger":
                    case "toExponential":
                    case "toFixed":
                    case "toPrecision":
                    case "toString":
                    case "valueOf":
                        break;

                }
                break;
            // case Symbol:
            //     switch (expression.methodName) {
            //         case "toString":
            //             break;
            //     }
            //     break;
            case Boolean:
                switch (expression.methodName) {
                    case "toString":
                        return "(CASE WHEN (" + this.getExpressionString(expression.objectOperand) + ") THEN " + this.getString("true") + " ELSE " + this.getString("false") + " END)";
                }
                break;
            case Date:
                switch (expression.methodName) {
                    case "getDate":
                        return "DAY(" + this.getExpressionString(expression.objectOperand) + ")";
                    case "getDay":
                        return "(DATEPART(weekday, " + this.getExpressionString(expression.objectOperand) + ") - 1)";
                    case "getFullYear":
                        return "YEAR(" + this.getExpressionString(expression.objectOperand) + ")";
                    case "getHours":
                        return "DATEPART(hour, " + this.getExpressionString(expression.objectOperand) + ")";
                    case "getMinutes":
                        return "DATEPART(minute, " + this.getExpressionString(expression.objectOperand) + ")";
                    case "getMonth":
                        return "(MONTH(" + this.getExpressionString(expression.objectOperand) + ") - 1)";
                    case "getSeconds":
                        return "DATEPART(second, " + this.getExpressionString(expression.objectOperand) + ")";
                    case "getMilliseconds":
                        return "DATEPART(millisecond, " + this.getExpressionString(expression.objectOperand) + ")";
                    case "getTime":
                    case "getTimezoneOffset":
                    case "getUTCDate":
                    case "getUTCDay":
                    case "getUTCFullYear":
                    case "getUTCHours":
                    case "getUTCMilliseconds":
                    case "getUTCMinutes":
                    case "getUTCMonth":
                    case "getUTCSeconds":
                        throw new Error(`${expression.methodName} not supported.`);
                    case "getYear":
                        throw new Error(`${expression.methodName} deprecated.`);
                    case "setDate":
                        return "DATEADD(DAY, (" + this.getExpressionString(expression.params[0]) + " - DAY(" + this.getExpressionString(expression.objectOperand) + ")), " + this.getExpressionString(expression.objectOperand) + ")";
                    case "setFullYear":
                        return "DATEADD(YYYY, (" + this.getExpressionString(expression.params[0]) + " - YEAR(" + this.getExpressionString(expression.objectOperand) + ")), " + this.getExpressionString(expression.objectOperand) + ")";
                    case "setHours":
                        return "DATEADD(HH, (" + this.getExpressionString(expression.params[0]) + " - DATEPART(hour, " + this.getExpressionString(expression.objectOperand) + ")), " + this.getExpressionString(expression.objectOperand) + ")";
                    case "setMilliseconds":
                        return "DATEADD(MS, (" + this.getExpressionString(expression.params[0]) + " - DATEPART(millisecond, " + this.getExpressionString(expression.objectOperand) + ")), " + this.getExpressionString(expression.objectOperand) + ")";
                    case "setMinutes":
                        return "DATEADD(MI, (" + this.getExpressionString(expression.params[0]) + " - DATEPART(minute, " + this.getExpressionString(expression.objectOperand) + ")), " + this.getExpressionString(expression.objectOperand) + ")";
                    case "setMonth":
                        return "DATEADD(MM, (" + this.getExpressionString(expression.params[0]) + " - (MONTH(" + this.getExpressionString(expression.objectOperand) + ") - 1)), " + this.getExpressionString(expression.objectOperand) + ")";
                    case "setSeconds":
                        return "DATEADD(SS, (" + this.getExpressionString(expression.params[0]) + " - DATEPART(second, " + this.getExpressionString(expression.objectOperand) + ")), " + this.getExpressionString(expression.objectOperand) + ")";
                    case "setTime":
                    case "setUTCDate":
                    case "setUTCFullYear":
                    case "setUTCHours":
                    case "setUTCMilliseconds":
                    case "setUTCMinutes":
                    case "setUTCMonth":
                    case "setUTCSeconds":
                    case "toJSON":
                    case "toISOString":
                    case "toLocaleDateString":
                    case "toLocaleTimeString":
                    case "toLocaleString":
                    case "toString":
                    case "valueOf":
                    case "toTimeString":
                    case "toUTCString":
                        throw new Error(`${expression.methodName} not supported.`);
                    case "setYear":
                        throw new Error(`${expression.methodName} deprecated.`);
                    case "toDateString":
                        return "CONCAT(LEFT(DATENAME(WEEKDAY, " + this.getExpressionString(expression.objectOperand) + "), 3), " + this.getString(" ") + ", " +
                            "LEFT(DATENAME(MONTH, " + this.getExpressionString(expression.objectOperand) + "), 3), " + this.getString(" ") + ", " +
                            "RIGHT(CONCAT(" + this.getString("0") + ", RTRIM(MONTH(" + this.getExpressionString(expression.objectOperand) + "))), 2)" + this.getString(" ") + ", " +
                            "RIGHT(CONCAT(" + this.getString("0") + ", RTRIM(MONTH(" + this.getExpressionString(expression.objectOperand) + "))), 2))";
                    case "toGMTString":
                        throw new Error(`${expression.methodName} deprecated.`);
                }
                break;
            case Function:
                switch (expression.methodName) {
                    case "apply":
                    case "bind":
                    case "call":
                    case "toSource":
                    case "toString":
                        break;
                }
                break;
            case Array:
                switch (expression.methodName) {
                    case "contains":
                    case "concat":
                    case "copyWithin":
                    case "every":
                    case "fill":
                    case "filter":
                    case "find":
                    case "findIndex":
                    case "forEach":
                    case "indexOf":
                    case "join":
                    case "lastIndexOf":
                    case "map":
                    case "pop":
                    case "push":
                    case "reduce":
                    case "reduceRight":
                    case "reverse":
                    case "shift":
                    case "slice":
                    case "some":
                    case "sort":
                    case "splice":
                    case "toString":
                    case "unshift":
                    case "valueOf":
                        break;
                }
                break;
            default:
                if (expression.objectOperand instanceof SelectExpression) {
                    switch (expression.methodName) {
                        case "count":
                            return "COUNT()";
                        case "sum":
                        case "min":
                        case "max":
                        case "avg":
                            return expression.methodName.toUpperCase() + "(" + this.getColumnString(expression.params[0] as any) + ")";
                        case "contains":
                            return this.getExpressionString(expression.params[0]) + " IN (" + this.getExpressionString(expression.objectOperand) + ")";
                    }
                }
                if (expression.objectOperand instanceof ValueExpression) {
                    switch (expression.objectOperand.value) {
                        case Date:
                            switch (expression.methodName) {
                                case "UTC":
                                case "now":
                                case "parse":
                                    throw new Error(`Date.${expression.methodName} not supported.`);
                            }
                            break;
                        case Math:
                            switch (expression.methodName) {
                                case "abs":
                                case "acos":
                                case "asin":
                                case "atan":
                                case "cos":
                                case "exp":
                                case "sin":
                                case "sqrt":
                                case "tan":
                                case "floor":
                                case "log":
                                case "log10":
                                case "sign":
                                    return expression.methodName.toUpperCase() + "(" + this.getExpressionString(expression.params[0]) + ")";
                                case "ceil":
                                    return "CEILING(" + this.getExpressionString(expression.params[0]) + ")";
                                case "atan2":
                                    return "ATN2(" + this.getExpressionString(expression.params[0]) + "," + this.getExpressionString(expression.params[1]) + ")";
                                case "pow":
                                    return "POWER(" + this.getExpressionString(expression.params[0]) + "," + this.getExpressionString(expression.params[1]) + ")";
                                case "random":
                                    return "RAND()";
                                case "round":
                                    return "ROUND(" + this.getExpressionString(expression.params[0]) + ", 0)";
                                case "expm1":
                                    return "(EXP(" + this.getExpressionString(expression.params[0]) + ") - 1)";
                                case "hypot":
                                    return "SQRT(" + expression.params.select((p) => "POWER(" + this.getExpressionString(p) + ", 2)").toArray().join(" + ") + ")";
                                case "log1p":
                                    return "LOG(1 + " + this.getExpressionString(expression.params[0]) + ")";
                                case "log2":
                                    return "LOG(" + this.getExpressionString(expression.params[0]) + ", 2)";
                                case "sinh":
                                    return "((EXP(" + this.getExpressionString(expression.params[0]) + ") - EXP(-" + this.getExpressionString(expression.params[0]) + ")) / 2)";
                                case "cosh":
                                    return "((EXP(" + this.getExpressionString(expression.params[0]) + ") + EXP(-" + this.getExpressionString(expression.params[0]) + ")) / 2)";
                                case "tanh":
                                    return "((EXP(2 * " + this.getExpressionString(expression.params[0]) + ") - 1) / (EXP(2 * " + this.getExpressionString(expression.params[0]) + ") + 1))";
                                case "trunc":
                                    return "(" + this.getExpressionString(expression.params[0]) + " | 0)";
                                case "max":
                                case "min":
                                case "acosh":
                                case "asinh":
                                case "atanh":
                                case "cbrt":
                                case "clz32":
                                case "fround":
                                case "imul":
                                    throw new Error(`method "Math.${expression.methodName}" not supported in linq to sql.`);
                            }
                            break;
                        case Array:
                            switch (expression.methodName) {
                                case "isArray":
                                    break;
                            }
                            break;
                    }
                }
                break;
        }
        const methodFn = expression.objectOperand.type.prototype[expression.methodName];
        if (methodFn) {
            // TODO: ToExpression must support this parameter
            const fnExpression = ExpressionFactory.prototype.ToExpression(methodFn, expression.objectOperand.type);
            for (let i = 0; i < fnExpression.params.length; i++) {
                const param = fnExpression.params[i];
                this.parameters.add(param.name, expression.params[i]);
            }
            this.parameters.add("this", expression.objectOperand);
            const result = this.getExpressionString(fnExpression.body);
            return result;
        }
        throw new Error(`type ${(expression.objectOperand.type as any).name} not supported in linq to sql.`);
    }
    protected getParameterExpressionString(expression: ParameterExpression): string {
        return this.getValueString(this.parameters.get(expression.name));
    }
    protected getValueExpressionString(expression: ValueExpression<any>): string {
        return this.getValueString(expression.value);
    }
    protected getValueString(value: any): string {
        switch (typeof value) {
            case "number":
                return this.getNumberString(value);
            case "boolean":
                return this.getBooleanString(value);
            case "undefined":
                return this.getNullString();
            case "string":
                return this.getString(value);
            default:
                if (value === null)
                    return this.getNullString();
                else if (value instanceof Date)
                    return this.getDateTimeString(value);

                throw new Error("type not supported");
        }
    }
    protected getDateTimeString(value: Date): string {
        return this.getString(value.getFullYear() + "-" + this.fillZero(value.getMonth() + 1) + "-" + this.fillZero(value.getDate()) + " " +
            this.fillZero(value.getHours()) + ":" + this.fillZero(value.getMinutes()) + ":" + this.fillZero(value.getSeconds()));
    }
    protected getNullString() {
        return "NULL";
    }
    protected getString(value: string) {
        return "'" + value + "'";
    }
    protected getBooleanString(value: boolean) {
        return value ? "1" : "0";
    }
    protected getNumberString(value: number) {
        return value.toString();
    }
    // tslint:disable-next-line:variable-name
    protected getFunctionExpressionString<T>(_expression: FunctionExpression<T>): string {
        throw new Error(`Function not supported`);
    }

    protected getTernaryExpressionString<T>(expression: TernaryExpression<T>): string {
        return "CASE WHEN (" + this.getExpressionString(expression.logicalOperand) + ") THEN " + this.getExpressionString(expression.trueResultOperand) + " ELSE " + this.getExpressionString(expression.falseResultOperand) + " END";
    }
    // tslint:disable-next-line:variable-name
    protected getObjectValueExpressionString<T extends { [Key: string]: IExpression }>(_expression: ObjectValueExpression<T>): string {
        throw new Error(`ObjectValue not supported`);
    }
    // tslint:disable-next-line:variable-name
    protected getArrayValueExpressionString<T>(_expression: ArrayValueExpression<T>): string {
        throw new Error(`ArrayValue not supported`);
    }

    protected getDivisionExpressionString(expression: DivisionExpression): string {
        return this.getExpressionString(expression.leftOperand) + " / " + this.getExpressionString(expression.rightOperand);
    }
    protected getEqualExpressionString(expression: EqualExpression): string {
        return this.getExpressionString(expression.leftOperand) + " = " + this.getExpressionString(expression.rightOperand);
    }
    protected getGreaterEqualExpressionString<T>(expression: GreaterEqualExpression<T>): string {
        return this.getExpressionString(expression.leftOperand) + " >= " + this.getExpressionString(expression.rightOperand);
    }
    protected getGreaterThanExpressionString<T>(expression: GreaterThanExpression<T>): string {
        return this.getExpressionString(expression.leftOperand) + " > " + this.getExpressionString(expression.rightOperand);
    }
    // tslint:disable-next-line:variable-name
    protected getInstanceofExpressionString(_expression: InstanceofExpression): string {
        throw new Error(`InstanceofExpression not supported`);
    }
    protected getLessEqualExpressionString<T>(expression: LessEqualExpression<T>): string {
        return this.getExpressionString(expression.leftOperand) + " <= " + this.getExpressionString(expression.rightOperand);
    }
    protected getLessThanExpressionString<T>(expression: LessThanExpression<T>): string {
        return this.getExpressionString(expression.leftOperand) + " < " + this.getExpressionString(expression.rightOperand);
    }
    protected getModulusExpressionString(expression: ModulusExpression): string {
        return this.getExpressionString(expression.leftOperand) + " % " + this.getExpressionString(expression.rightOperand);
    }
    protected getNotEqualExpressionString(expression: NotEqualExpression): string {
        return this.getExpressionString(expression.leftOperand) + " <> " + this.getExpressionString(expression.rightOperand);
    }
    protected getOrExpressionString(expression: OrExpression): string {
        return this.getExpressionString(expression.leftOperand) + " OR " + this.getExpressionString(expression.rightOperand);
    }
    protected getStrictEqualExpressionString<T>(expression: StrictEqualExpression<T>): string {
        return this.getEqualExpressionString(expression);
    }
    protected getStrictNotEqualExpressionString(expression: StrictNotEqualExpression): string {
        return this.getNotEqualExpressionString(expression);
    }
    protected getSubtractionExpressionString(expression: SubtractionExpression): string {
        return this.getExpressionString(expression.leftOperand) + " - " + this.getExpressionString(expression.rightOperand);
    }
    protected getTimesExpressionString(expression: TimesExpression): string {
        return this.getExpressionString(expression.leftOperand) + " * " + this.getExpressionString(expression.rightOperand);
    }

    protected getAdditionExpressionString<T extends string | number>(expression: AdditionExpression<T>): string {
        if (expression.type as any === String)
            return "CONCAT(" + this.getExpressionString(expression.leftOperand) + ", " + this.getExpressionString(expression.rightOperand) + ")";

        return this.getExpressionString(expression.leftOperand) + " + " + this.getExpressionString(expression.rightOperand);
    }
    protected getAndExpressionString(expression: AndExpression): string {
        return this.getExpressionString(expression.leftOperand) + " AND " + this.getExpressionString(expression.rightOperand);
    }
    // tslint:disable-next-line:variable-name
    protected getLeftDecrementExpressionString(_expression: LeftDecrementExpression): string {
        throw new Error(`LeftDecrement not supported`);
    }
    // tslint:disable-next-line:variable-name
    protected getLeftIncrementExpressionString(_expression: LeftIncrementExpression): string {
        throw new Error(`LeftIncrement not supported`);
    }
    protected getNotExpressionString(expression: NotExpression): string {
        const operandString = this.getExpressionString(expression.operand);
        if (expression.operand instanceof ColumnExpression)
            return operandString + "<> 1";
        return "NOT " + operandString;
    }
    // tslint:disable-next-line:variable-name
    protected getRightDecrementExpressionString(_expression: RightIncrementExpression): string {
        throw new Error(`RightDecrement not supported`);
    }
    // tslint:disable-next-line:variable-name
    protected getRightIncrementExpressionString(_expression: RightIncrementExpression): string {
        throw new Error(`RightIncrement not supported`);
    }
    // tslint:disable-next-line:variable-name
    protected getTypeofExpressionString(_expression: TypeofExpression): string {
        throw new Error(`Typeof not supported`);
    }

    protected getBitwiseNotExpressionString(expression: BitwiseNotExpression): string {
        const operandString = this.getExpressionString(expression.operand);
        return "~ " + operandString;
    }
    protected getBitwiseAndExpressionString(expression: BitwiseAndExpression): string {
        return this.getExpressionString(expression.leftOperand) + " & " + this.getExpressionString(expression.rightOperand);
    }
    protected getBitwiseOrExpressionString(expression: BitwiseOrExpression): string {
        return this.getExpressionString(expression.leftOperand) + " | " + this.getExpressionString(expression.rightOperand);
    }
    protected getBitwiseXorExpressionString(expression: BitwiseXorExpression): string {
        return this.getExpressionString(expression.leftOperand) + " ^ " + this.getExpressionString(expression.rightOperand);
    }
    // http://dataeducation.com/bitmask-handling-part-4-left-shift-and-right-shift/
    // tslint:disable-next-line:variable-name
    protected getBitwiseSignedRightShiftExpressionString(_expression: BitwiseSignedRightShiftExpression): string {
        throw new Error(`BitwiseSignedRightShift not supported`);
    }
    // tslint:disable-next-line:variable-name
    protected getBitwiseZeroRightShiftExpressionString(_expression: BitwiseZeroRightShiftExpression): string {
        throw new Error(`BitwiseSignedRightShift not supported`);
    }
    // tslint:disable-next-line:variable-name
    protected getBitwiseZeroLeftShiftExpressionString(_expression: BitwiseZeroLeftShiftExpression): string {
        throw new Error(`BitwiseSignedRightShift not supported`);
    }
    private fillZero(value: number): string {
        return value < 10 ? ("0" + value).slice(-2) : value.toString();
    }
}
