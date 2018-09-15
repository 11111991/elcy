import { ExpressionTransformer } from "../ExpressionTransformer";
import { ExpressionBase, IExpression } from "./IExpression";
import { ValueExpression } from "./ValueExpression";

export class ArrayValueExpression<TType> extends ExpressionBase<TType[]> {
    public static create<TType>(...values: Array<IExpression<TType>>) {
        const result = new ArrayValueExpression<TType>(...values);
        if (values.every((param) => param instanceof ValueExpression))
            return ValueExpression.create<TType[]>(result);

        return result;
    }
    public items: Array<IExpression<TType>>;
    constructor(...items: Array<IExpression<TType>>) {
        super(Array);
        this.items = items;
    }

    public toString(transformer?: ExpressionTransformer): string {
        if (transformer)
            return transformer.getExpressionString(this);
        const itemString = [];
        for (const item of this.items)
            itemString.push(item.toString());
        return "[" + itemString.join(", ") + "]";
    }
    public execute(transformer: ExpressionTransformer) {
        const arrayValues = [];
        for (const item of this.items)
            arrayValues.push(item.execute(transformer));
        return arrayValues;
    }
    public clone(replaceMap?: Map<IExpression, IExpression>) {
        if (!replaceMap) replaceMap = new Map();
        return new ArrayValueExpression(...this.items.select(o => replaceMap.has(o) ? replaceMap.get(o) : o.clone(replaceMap)).toArray());
    }
}
