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

    public ToString(): string {
        return "~" + this.Operand.ToString();
    }
    public Execute() {
        // tslint:disable-next-line:no-bitwise
        return ~this.Operand.Execute();
    }
}
