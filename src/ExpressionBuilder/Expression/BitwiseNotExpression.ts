import { ExpressionTransformer } from "../ExpressionTransformer";
import { ExpressionBase, IExpression } from "./IExpression";
import { ValueExpression } from "./ValueExpression";
export class BitwiseNotExpression extends ExpressionBase<number> {
    public static Create(operand: IExpression) {
        const result = new BitwiseNotExpression(operand);
        if (operand instanceof ValueExpression)
            return ValueExpression.Create<number>(result);

        return result;
    }
    constructor(protected Operand: IExpression) {
        super(Number);
    }

    public toString(transformer: ExpressionTransformer): string {
        return "~" + this.Operand.toString(transformer);
    }
    public execute(transformer: ExpressionTransformer) {
        // tslint:disable-next-line:no-bitwise
        return ~this.Operand.execute(transformer);
    }
}
