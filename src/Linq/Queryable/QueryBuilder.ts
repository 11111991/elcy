import { ExpressionTransformer } from "../../ExpressionBuilder/ExpressionTransformer";
import { ColumnExpression } from "./QueryExpression/ColumnExpression";
import { GroupByExpression } from "./QueryExpression/GroupByExpression";
import { JoinTableExpression } from "./QueryExpression/JoinTableExpression";
import { OrderByExpression } from "./QueryExpression/OrderByExpression";
import { SelectExpression } from "./QueryExpression/SelectExpression";
import { EntityExpression } from "./QueryExpression/TableExpression";
import { UnionExpression } from "./QueryExpression/UnionExpression";
import { WhereExpression } from "./QueryExpression/WhereExpression";
import { IColumnExpression } from "./QueryExpression/IColumnExpression";

export abstract class QueryBuilder extends ExpressionTransformer {
    public enableEscape: boolean = true;
    public parameters: { [key: string]: any } = {};
    public namingStrategy = {};
    private aliasCount: number = 0;
    public newAlias() {
        return "ALIAS" + this.aliasCount++;
    }
    public escape(identity: string) {
        if (this.enableEscape)
            return "[" + identity + "]";
        else
            return identity;
    }
    public toColumnString(column: IColumnExpression) {
        return this.escape(column.entity.alias) + "." + this.escape(column.alias ? column.alias : column.name);
    }
    public toEntityString(entity: EntityExpression): string {
        if (entity instanceof SelectExpression)
            return "(" + entity.toString(this) + ") AS " + this.escape(entity.alias);
        else
            return this.escape(entity.name) + (entity.alias ? " AS " + this.escape(entity.alias) : "");
    }
    public toJoinEntityString(entity: JoinTableExpression) {
        return entity.leftEntity.toString(this) + " " +
            entity.joinType + " JOIN " +
            entity.rightEntity.toString(this) +
            " ON " + entity.relations.select((o) => o.leftColumn.toString(this) + " = " + o.rightColumn.toString(this)).toArray().join(" AND ");
    }
    public toSelectString(select: SelectExpression | WhereExpression | UnionExpression | GroupByExpression): string {
        if (select instanceof WhereExpression)
            return this.toWhereString(select);
        if (select instanceof UnionExpression)
            return this.toUnionString(select);
        let result = "SELECT " +
            (select.distinct ? " DISTINCT" : "") + " " +
            (select.top ? "TOP " + select.top : "") + " " +
            select.columns.select((o) => o.toString(this)).toArray().join(", ") + " " +
            "FROM " + this.toEntityString(select.entity);
        if (select instanceof GroupByExpression)
            result += " GROUP BY " + select.groupBy.select((o) => o.toString(this)).toArray().join(", ");
        return result;
    }
    public toWhereString(where: WhereExpression): string {
        return this.toSelectString(where.select) + " " +
            (where.select instanceof GroupByExpression ? "HAVING " : "WHERE ") + where.where.toString();
    }
    public toOrderString(order: OrderByExpression): string {
        return this.toSelectString(order.select) + " " +
            "ORDER BY " + order.orders.select((o) => o.column.toString(this) + " " + o.direction).toArray().join(", ");
    }
    public toUnionString(union: UnionExpression) {
        return union.leftEntity.toString(this) +
            "UNION " + (union.isUnionAll ? "ALL " : "") +
            union.rightEntity.toString(this);
    }
}
