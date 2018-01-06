import { FunctionExpression, IExpression } from "./Expression";
import { TransformerParameter } from "./TransformerParameter";

export abstract class ExpressionTransformer {
    public parameters = new TransformerParameter();

    public executeExpression(expression: IExpression): any {
        if (expression instanceof FunctionExpression) {
            expression.Body.execute(this);
        }
    }
}