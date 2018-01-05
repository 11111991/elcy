import { ExpressionBase, IExpression } from "./IExpression";
import { ValueExpression } from "./ValueExpression";

export class ObjectValueExpression<TType extends { [Key: string]: IExpression }> extends ExpressionBase<TType> {
    public static Create<TType extends { [Key: string]: IExpression }>(objectValue: TType) {
        const result = new ObjectValueExpression(objectValue);
        let isAllValue = true;
        for (const prop in objectValue) {
            if (!(objectValue[prop] instanceof ValueExpression)) {
                isAllValue = false;
                break;
            }
        }
        if (isAllValue)
            return ValueExpression.Create<TType>(objectValue);

        return result;
    }
    public Object: TType;
    constructor(objectValue: TType) {
        super();
        this.Object = objectValue;
    }

    public toString() {
        const itemString = [];
        for (const item in this.Object)
            itemString.push(item + ": " + this.Object[item].toString());
        return "{" + itemString.join(", ") + "}";
    }
    public execute(): TType {
        const objectValue: { [Key: string]: IExpression } = {};
        for (const prop in this.Object)
            objectValue[prop] = this.Object[prop].execute();
        return objectValue as TType;
    }
}
