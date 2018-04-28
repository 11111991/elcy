import { QueryBuilder } from "../../QueryBuilder/QueryBuilder";
import { ColumnType, ColumnTypeMapKey } from "../../Common/ColumnType";
import { IColumnTypeDefaults } from "../../Common/IColumnTypeDefaults";
import { GenericType } from "../../Common/Type";
import { TimeSpan } from "../../Common/TimeSpan";
import { SelectExpression } from "../../Queryable/QueryExpression/SelectExpression";

export class MssqlQueryBuilder extends QueryBuilder {
    protected supportedColumnTypes: ColumnType[] = [
        "bigint",
        "bit",
        "decimal",
        "int",
        "money",
        "numeric",
        "smallint",
        "smallmoney",
        "tinyint",
        "float",
        "real",
        "date",
        "datetime2",
        "datetime",
        "datetimeoffset",
        "smalldatetime",
        "time",
        "char",
        "text",
        "varchar",
        "nchar",
        "ntext",
        "nvarchar",
        "binary",
        "image",
        "varbinary",
        "cursor",
        "hierarchyid",
        "sql_variant",
        "table",
        "timestamp",
        "uniqueidentifier",
        "xml"
    ];
    protected columnTypesWithOption: ColumnType[] = [
        "binary",
        "char",
        "datetime2",
        "datetimeoffset",
        "decimal",
        "nchar",
        "numeric",
        "nvarchar",
        "time",
        "varbinary",
        "varchar",
    ];
    protected columnTypeDefaults = new Map<ColumnType, IColumnTypeDefaults>([
        ["binary", { size: 50 }],
        ["char", { size: 10 }],
        ["datetime2", { precision: 1 }],
        ["datetimeoffset", { precision: 7 }],
        ["decimal", { precision: 18, scale: 0 }],
        ["nchar", { size: 10 }],
        ["numeric", { precision: 18, scale: 0 }],
        ["nvarchar", { size: 255 }],
        ["time", { precision: 7 }],
        ["varbinary", { size: 50 }],
        ["varchar", { size: 50 }]
    ]);
    protected columnTypeMap = new Map<ColumnTypeMapKey, ColumnType>([
        ["defaultBoolean", "bit"],
        ["defaultBinary", "binary"],
        ["defaultDataString", "xml"],
        ["defaultDate", "datetime"],
        ["defaultDecimal", "decimal"],
        ["defaultEnum", "nvarchar"],
        ["defaultIdentifier", "uniqueidentifier"],
        ["defaultNumberic", "int"],
        ["defaultString", "nvarchar"],
        ["defaultTime", "time"],
        ["defaultTimestamp", "timestamp"]
    ]);
    protected valueTypeMap = new Map<GenericType, ColumnType>([
        [TimeSpan, "time"],
        [Date, "datetime"],
        [String, "nvarchar"],
        [Number, "decimal"],
        [Boolean, "bit"]
    ]);
    protected getPagingQueryString(select: SelectExpression): string {
        const skip = select.paging.skip || 0;
        const take = select.paging.take || 0;
        let result = "";
        if (select.orders.length <= 0)
            result += "ORDER BY (SELECT NULL)" + this.newLine();
        result += "OFFSET " + skip + " ROWS";
        if (take > 0)
            result += this.newLine() + "FETCH NEXT " + take + " ROWS ONLY";
        return result;
    }
}
