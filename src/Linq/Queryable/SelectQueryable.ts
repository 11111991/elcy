import { genericType } from "../../Common/Type";
import { FunctionExpression, ObjectValueExpression, MethodCallExpression } from "../../ExpressionBuilder/Expression/index";
import { ExpressionFactory } from "../../ExpressionBuilder/ExpressionFactory";
import { Queryable } from "./Queryable";
import { ColumnExpression, ComputedColumnExpression, IColumnExpression, IEntityExpression, SelectExpression } from "./QueryExpression";

export class SelectQueryable<S, T> extends Queryable<T> {
    protected readonly selector: FunctionExpression<S, T>;
    constructor(public readonly parent: Queryable<S>, selector: ((item: S) => T) | FunctionExpression<S, T>, public type: genericType<T> = Object) {
        super(type, parent.queryBuilder);
        this.selector = selector instanceof FunctionExpression ? selector : ExpressionFactory.prototype.ToExpression<S, T>(selector, parent.type);
    }
    public execute(): SelectExpression<T> {
        if (!this.expression) {
            this.expression = new SelectExpression<any>(this.parent.execute());
            const methodExpression = new MethodCallExpression(this.expression.entity, "select", [this.selector]);
            const param = { parent: this.expression };
            this.queryBuilder.visit(methodExpression, param);
            this.expression = param.parent;
        }
        return this.expression;
    }
}