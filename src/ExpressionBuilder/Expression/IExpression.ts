import { genericType, IObjectType } from "../../Common/Type";
import { ExpressionTransformer } from "../ExpressionTransformer";
export interface IExpression<T = any> {
    type: genericType<T>;
    toString(transformer: ExpressionTransformer): string;
    execute(transformer: ExpressionTransformer): T | any;
}

export class ExpressionBase<T = any> implements IExpression<T> {
    public type: genericType<T>;
    constructor(type?: genericType<T>) {
        if (type)
            this.type = type;
    }
    public toString() {
        return "";
    }
    public execute(): T {
        if ((this.type as IObjectType<T>).prototype)
            return new (this.type as IObjectType<T>)();
        return (this.type as () => T)();
    }
}
