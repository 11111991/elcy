import { QueryBuilder } from "../../QueryBuilder/QueryBuilder";
import { ColumnType, ColumnTypeMapKey, ColumnGroupType } from "../../Common/ColumnType";
import { IColumnTypeDefaults } from "../../Common/IColumnTypeDefaults";
import { GenericType } from "../../Common/Type";
import { TimeSpan } from "../../Common/TimeSpan";
import { QueryTranslator } from "../../QueryBuilder/QueryTranslator/QueryTranslator";
import { UUID } from "../../Data/UUID";
import { IEntityMetaData } from "../../MetaData/Interface/IEntityMetaData";

export const sqliteQueryTranslator = new QueryTranslator(Symbol("sqlite"));
export class SqliteQueryBuilder extends QueryBuilder {
    public supportedColumnTypes: Map<ColumnType, ColumnGroupType> = new Map<ColumnType, ColumnGroupType>([
        ["integer", "Numeric"],
        ["numeric", "Decimal"],
        ["text", "String"],
        ["blob", "Binary"],
        ["real", "Real"],
    ]);
    public columnTypesWithOption: ColumnType[] = [];
    public columnTypeDefaults = new Map<ColumnType, IColumnTypeDefaults>();
    public columnTypeMap = new Map<ColumnTypeMapKey, ColumnType>([
        ["defaultBoolean", "numeric"],
        ["defaultBinary", "blob"],
        ["defaultDataString", "text"],
        ["defaultDate", "text"],
        ["defaultDecimal", "numeric"],
        ["defaultEnum", "text"],
        ["defaultIdentifier", "text"],
        ["defaultNumberic", "integer"],
        ["defaultReal", "real"],
        ["defaultString", "text"],
        ["defaultTime", "text"],
        ["defaultRowVersion", "blob"]
    ]);
    public valueTypeMap = new Map<GenericType, ColumnType>([
        [TimeSpan, "text"],
        [Date, "text"],
        [String, "text"],
        [Number, "numeric"],
        [Boolean, "numeric"],
        [UUID, "text"]
    ]);
    public resolveTranslator(object: any, memberName?: string) {
        let result = sqliteQueryTranslator.resolve(object, memberName);
        if (!result)
            result = super.resolveTranslator(object, memberName);
        return result;
    }
    public entityName(entityMeta: IEntityMetaData<any>) {
        return `${this.enclose(entityMeta.name)}`;
    }
}