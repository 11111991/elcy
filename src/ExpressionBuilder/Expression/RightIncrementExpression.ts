import { ExpressionTransformer } from "../ExpressionTransformer";
import { ExpressionBase, IExpression } from "./IExpression";
import { ValueExpression } from "./ValueExpression";
export class RightIncrementExpression extends ExpressionBase<number> {
    public static Create(operand: IExpression<number>) {
        const result = new RightIncrementExpression(operand);
        if (operand instanceof ValueExpression)
            return ValueExpression.Create<number>(result);

        return result;
    }
    constructor(public readonly Operand: IExpression) {
        super(Number);
    }

    public toString(transformer: ExpressionTransformer): string {
        return this.Operand.toString(transformer) + "++";
    }
    // TODO: return before increment;
    public execute(transformer: ExpressionTransformer) {
        return this.Operand.execute(transformer);
    }
}
