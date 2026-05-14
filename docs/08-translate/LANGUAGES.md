# Translate — Language Catalog

*Kompletný katalóg podporovaných jazykov. Verzia 0.1. Pozri [GOAL.md](./GOAL.md) pre kontext.*

---

## Legenda

| Symbol | Tier | Čo AIBIo urobí |
|---|---|---|
| ✅ full-exec | Execute + Compare s DuckDB ground truth | Presný výsledok: ✅ Equivalent / ❌ Mismatch |
| 🔲 sandbox | Execute v izolovanom prostredí (voliteľné) | Pomalšie, vyžaduje setup |
| ℹ️ syntax-only | Syntax validation bez execúcie | Syntax OK / Syntax Error |
| 📄 gen-only | Generácia bez validácie | Kód bez spätnej väzby |

---

## SQL rodina

### `sql:duckdb` — DuckDB SQL ✅

Natívny AIBIo engine. Toto je ground truth pre všetky ostatné jazyky.

**Profesionálne vzory:**
```sql
-- Window function s QUALIFY (DuckDB-specific)
SELECT
    order_id,
    customer_id,
    order_date,
    total_amount,
    SUM(total_amount) OVER (
        PARTITION BY customer_id
        ORDER BY order_date
        ROWS UNBOUNDED PRECEDING
    ) AS running_total,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
FROM orders
QUALIFY rn = 1   -- DuckDB-specific: latest order per customer
```

**Špeciality DuckDB:**
- `QUALIFY` clause (neexistuje v štandardnom SQL)
- `LIST_AGG`, `ARRAY_AGG` s rôznou syntaxou
- `COLUMNS(regex)` pre dynamický select
- `PIVOT` / `UNPIVOT`
- Lambda funkcie: `list_transform(col, x -> x * 2)`

---

### `sql:postgres` — PostgreSQL ✅

Execution via DuckDB PostgreSQL dialect adapter.

**Kľúčové rozdiely vs DuckDB:**
- `QUALIFY` → nahradené `WHERE rn = 1` (CTE + ROW_NUMBER wrapper)
- `STRING_AGG` namiesto `LIST_AGG`
- `ARRAY_AGG` syntax odlišná
- `DATE_TRUNC` namiesto `DATE_FLOOR`
- `::type` casting syntax (PostgreSQL-specific)

```sql
-- PostgreSQL: latest order per customer (bez QUALIFY)
WITH ranked AS (
    SELECT
        order_id,
        customer_id,
        order_date,
        total_amount,
        SUM(total_amount) OVER (
            PARTITION BY customer_id
            ORDER BY order_date
            ROWS UNBOUNDED PRECEDING
        )::numeric(15,2) AS running_total,
        ROW_NUMBER() OVER (
            PARTITION BY customer_id
            ORDER BY order_date DESC
        ) AS rn
    FROM orders
)
SELECT order_id, customer_id, order_date, total_amount, running_total
FROM ranked
WHERE rn = 1
```

---

### `sql:bigquery` — BigQuery (GoogleSQL) ✅

Execution via DuckDB BigQuery dialect.

**Kľúčové rozdiely:**
- `QUALIFY` ✅ (BigQuery ho podporuje — jedna z mála platforiem)
- Backtick quoting: `` `project.dataset.table` ``
- `STRUCT` a `ARRAY` typy natívne
- `FARM_FINGERPRINT` pre hashing
- `EXCEPT` v SELECT: `SELECT * EXCEPT (column_to_remove)`
- `DATE`, `DATETIME`, `TIMESTAMP` sú rôzne typy

```sql
-- BigQuery: QUALIFY supported + EXCEPT
SELECT
    * EXCEPT (internal_id),
    SUM(total_amount) OVER (
        PARTITION BY customer_id
        ORDER BY order_date
    ) AS running_total
FROM `project.dataset.orders`
QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1
```

---

### `sql:snowflake` — Snowflake SQL ℹ️

Syntax validation. Execution vyžaduje Snowflake account.

**Kľúčové rozdiely:**
- `QUALIFY` ✅ (Snowflake ho podporuje natívne)
- `FLATTEN` pre arrays/variants
- `PARSE_JSON` / `GET` pre semi-structured data
- `$1`, `$2` column referencing
- Identifier quoting je case-sensitive s uvodzovkami

```sql
-- Snowflake: QUALIFY + FLATTEN example
SELECT
    order_id,
    customer_id,
    order_date,
    total_amount,
    SUM(total_amount) OVER (PARTITION BY customer_id ORDER BY order_date) AS running_total
FROM orders
QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1
```

---

### `sql:trino` — Trino / Presto SQL ℹ️

Syntax validation only.

**Kľúčové rozdiely:**
- `APPROX_DISTINCT` pre cardinality estimation
- `ARRAY_JOIN` namiesto `STRING_AGG`
- `WITH NO DATA` pre CTAS
- `AT TIME ZONE` handling

---

### `sql:sparksql` — Spark SQL ✅

Execution via DuckDB (Spark-compatible subset). Komplexné Spark-specifické features = syntax-only fallback.

**Kľúčové rozdiely:**
- `LATERAL VIEW EXPLODE` pre arrays
- `COLLECT_LIST` / `COLLECT_SET`
- `PERCENTILE_APPROX`
- Bez `QUALIFY` — CTE + WHERE workaround

---

### `sql:dbt` — dbt SQL (Jinja templated) ℹ️

Syntax validation: Jinja template parsing + `ref()` / `source()` reference check.

```sql
-- dbt SQL: Jinja templating
WITH source AS (
    SELECT * FROM {{ source('northwind', 'orders') }}
),
renamed AS (
    SELECT
        order_id,
        customer_id,
        order_date,
        {{ cents_to_dollars('total_amount_cents') }} AS total_amount
    FROM source
)
SELECT * FROM renamed
```

---

## Python rodina

### `python:pandas` — pandas ✅

**Profesionálne vzory:**

```python
from __future__ import annotations

from typing import TYPE_CHECKING

import pandas as pd
from sqlalchemy import text

if TYPE_CHECKING:
    from sqlalchemy import Engine


def load_fct_sales(
    engine: Engine,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
    max_rows: int = 100_000,
) -> pd.DataFrame:
    """Sales fact table.

    Grain: one row per order_id.
    Partitioning key: order_date (use for incremental loads).
    """
    filters: list[str] = ["1=1"]
    params: dict[str, object] = {}

    if start_date:
        filters.append("order_date >= :start_date")
        params["start_date"] = start_date
    if end_date:
        filters.append("order_date < :end_date")
        params["end_date"] = end_date

    query = text(f"""
        SELECT
            order_id,
            customer_id,
            product_id,
            order_date,
            total_amount,
            quantity
        FROM fct_sales
        WHERE {' AND '.join(filters)}
        LIMIT :max_rows
    """)

    df = pd.read_sql(query, engine, params={**params, "max_rows": max_rows})

    return df.astype({
        "order_id":    "int32",
        "customer_id": "int32",
        "product_id":  "int32",
        "total_amount": "float64",
        "quantity":     "int16",
    }).assign(
        order_date=lambda x: pd.to_datetime(x["order_date"], utc=True)
    )
```

**Execution harness (AIBIo internal):**
```python
# AIBIo injects this wrapper around generated code to capture output
import json, sys
result_df = load_fct_sales(engine)
print(json.dumps({
    "rows": result_df.head(500).to_dict(orient="records"),
    "schema": result_df.dtypes.astype(str).to_dict(),
    "row_count": len(result_df)
}))
```

---

### `python:polars` — Polars (lazy) ✅

```python
from __future__ import annotations

import polars as pl


def transform_fct_sales(
    source: pl.LazyFrame,
    *,
    start_date: str | None = None,
    end_date: str | None = None,
) -> pl.LazyFrame:
    """Sales fact table transformation.

    Grain: one row per order_id.
    Returns lazy frame — call .collect() to materialize.
    """
    frame = source.select([
        pl.col("order_id").cast(pl.Int32),
        pl.col("customer_id").cast(pl.Int32),
        pl.col("product_id").cast(pl.Int32),
        pl.col("order_date").cast(pl.Date),
        pl.col("total_amount").cast(pl.Decimal(scale=2)),
        pl.col("quantity").cast(pl.Int16),
    ])

    if start_date:
        frame = frame.filter(pl.col("order_date") >= pl.lit(start_date).cast(pl.Date))
    if end_date:
        frame = frame.filter(pl.col("order_date") < pl.lit(end_date).cast(pl.Date))

    return (
        frame
        .filter(pl.col("order_id").is_not_null())
        .unique(subset=["order_id"], keep="last")
        .sort("order_date", descending=True)
    )
```

**Kľúčové Polars idiomy:**
- Lazy evaluation — vždy `LazyFrame`, nikdy eager `DataFrame` v transformation functions
- `pl.col()` expressions, žiadne pandas `.apply()` anti-patterns
- `cast()` namiesto inference
- `is_not_null()` / `fill_null()` namiesto pandas `notnull()` / `fillna()`
- `pl.struct()` pre nested records
- `group_by().agg()` namiesto `groupby().agg()`

---

### `python:ibis` — ibis (DuckDB backend) ✅

```python
import ibis
import ibis.expr.types as ir

ibis.options.interactive = False   # lazy mode

def transform_fct_sales(
    con: ibis.BaseBackend,
    *,
    start_date: str | None = None,
) -> ir.Table:
    """Sales fact table — ibis expression.

    Backend-agnostic: works with DuckDB, BigQuery, Snowflake, Spark.
    """
    t = con.table("fct_sales")

    expr = t.select(
        t.order_id.cast("int32"),
        t.customer_id.cast("int32"),
        t.order_date.cast("date"),
        t.total_amount.cast("decimal(15, 2)"),
        t.quantity.cast("int16"),
    )

    if start_date:
        expr = expr.filter(expr.order_date >= ibis.date(start_date))

    return expr.order_by(expr.order_date.desc())
```

**Prečo ibis:** Jediný Python framework kde tá istá transformácia beží na DuckDB, BigQuery, Snowflake, Spark bez zmeny kódu.

---

### `python:pyspark` — PySpark 🔲 (sandbox)

Vyžaduje Docker s lokálnym Spark containerom. Default tier: `gen-only` ak Docker nie je dostupný.

```python
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField,
    IntegerType, StringType, DecimalType, DateType, ShortType,
)

SCHEMA = StructType([
    StructField("order_id",    IntegerType(), nullable=False),
    StructField("customer_id", IntegerType(), nullable=False),
    StructField("product_id",  IntegerType(), nullable=False),
    StructField("order_date",  DateType(),    nullable=False),
    StructField("total_amount", DecimalType(15, 2), nullable=False),
    StructField("quantity",    ShortType(),   nullable=False),
])

def transform_fct_sales(
    spark: SparkSession,
    df: DataFrame,
    start_date: str | None = None,
) -> DataFrame:
    """Sales fact table — Spark DataFrame.

    Grain: order_id.
    Repartition by order_date for optimal storage in Delta/Parquet.
    """
    result = (
        df
        .select(
            F.col("order_id").cast(IntegerType()),
            F.col("customer_id").cast(IntegerType()),
            F.col("product_id").cast(IntegerType()),
            F.to_date(F.col("order_date")).alias("order_date"),
            F.col("total_amount").cast(DecimalType(15, 2)),
            F.col("quantity").cast(ShortType()),
        )
        .filter(F.col("order_id").isNotNull())
        .dropDuplicates(["order_id"])
    )

    if start_date:
        result = result.filter(F.col("order_date") >= F.lit(start_date).cast(DateType()))

    return result.repartition(F.col("order_date"))
```

---

### `python:sqlalchemy` — SQLAlchemy 2.0 ORM ℹ️

Syntax validation: mypy type check + `alembic revision --autogenerate --sql` dry-run.

```python
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, SmallInteger, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class DimCustomer(Base):
    """Customer dimension. Grain: customer_id."""
    __tablename__ = "dim_customer"

    customer_id:   Mapped[int]      = mapped_column(primary_key=True)
    customer_name: Mapped[str]      = mapped_column(String(255), nullable=False)
    region:        Mapped[str | None] = mapped_column(String(100))
    country:       Mapped[str]      = mapped_column(String(100), nullable=False)

    # PII: email, phone — classified in AIBIo governance, excluded from default SELECT
    # email:       Mapped[str | None] = mapped_column(String(255))
    # phone:       Mapped[str | None] = mapped_column(String(50))

    orders: Mapped[list[FctSales]] = relationship(back_populates="customer")


class FctSales(Base):
    """Sales fact table. Grain: order_id."""
    __tablename__ = "fct_sales"

    order_id:    Mapped[int]     = mapped_column(primary_key=True)
    customer_id: Mapped[int]     = mapped_column(ForeignKey("dim_customer.customer_id"))
    order_date:  Mapped[date]    = mapped_column(Date, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    quantity:    Mapped[int]     = mapped_column(SmallInteger, nullable=False)

    customer: Mapped[DimCustomer] = relationship(back_populates="orders")
```

---

### `python:dbt` — dbt Python model ℹ️

Validation: `dbt parse --select model_name` bez execúcie.

```python
import pandas as pd

def model(dbt, session) -> pd.DataFrame:
    """Sales fact table — dbt Python model.

    Grain: order_id.
    Refs: stg_northwind__orders, stg_northwind__order_items
    """
    dbt.config(
        materialized="incremental",
        unique_key="order_id",
    )

    orders = dbt.ref("stg_northwind__orders")
    items  = dbt.ref("stg_northwind__order_items")

    result = (
        orders
        .merge(items, on="order_id", how="left")
        .groupby(["order_id", "customer_id", "order_date"])
        .agg(
            total_amount=("unit_price", "sum"),
            quantity=("quantity", "sum"),
        )
        .reset_index()
    )

    if dbt.is_incremental:
        max_date = session.execute("SELECT MAX(order_date) FROM {{ this }}").scalar()
        if max_date:
            result = result[result["order_date"] > max_date]

    return result
```

---

## Microsoft BI

### `bi:dax` — DAX (Power BI / Analysis Services) ℹ️

Syntax validation: DAX expression parser.

**Profesionálne vzory — merania (measures):**

```dax
// Total Revenue — základná miera
Total Revenue =
    SUMX(
        fct_sales,
        fct_sales[total_amount]
    )

// Revenue YTD — time intelligence
Revenue YTD =
    CALCULATE(
        [Total Revenue],
        DATESYTD(Calendar[Date])
    )

// Revenue vs Prior Year — porovnanie
Revenue vs PY =
    VAR _Current  = [Total Revenue]
    VAR _PriorYear =
        CALCULATE(
            [Total Revenue],
            SAMEPERIODLASTYEAR(Calendar[Date])
        )
    RETURN
        DIVIDE(_Current - _PriorYear, _PriorYear, BLANK())

// Dynamic measure — SWITCH pattern
Selected Metric =
    SWITCH(
        SELECTEDVALUE(MetricSelector[Metric]),
        "Revenue",  [Total Revenue],
        "Orders",   [Order Count],
        "Avg Order", [Avg Order Value],
        BLANK()
    )

// Rolling 3-month average
Rolling 3M Revenue =
    VAR _LastDate = MAX(Calendar[Date])
    VAR _FirstDate = DATEADD(Calendar[Date], -3, MONTH)
    RETURN
        CALCULATE(
            [Total Revenue],
            DATESBETWEEN(Calendar[Date], _FirstDate, _LastDate)
        )
```

**Syntax validator kontroluje:**
- Správne uzátvorkenie CALCULATE/MEASURE
- VAR deklarácie pred RETURN
- BLANK() ako fallback v DIVIDE
- Time intelligence funkcie len v kontexte Date tabuľky

---

### `bi:powerquery` — Power Query M ℹ️

Syntax validation: M expression grammar parser.

**Profesionálne vzory:**

```powerquery
// Parameterized, query-folding-safe staging query
let
    // --- Connection (query folding preserved here) ---
    Source = Sql.Database(
        Parameters[ServerName],
        Parameters[DatabaseName],
        [Query = null, CommandTimeout = #duration(0, 0, 30, 0)]
    ),
    Orders = Source{[Schema = "dbo", Item = "Orders"]}[Data],

    // --- Column selection (query folding: YES) ---
    Selected = Table.SelectColumns(
        Orders,
        {"OrderID", "CustomerID", "OrderDate", "TotalAmount", "Status"},
        MissingField.Error
    ),

    // --- Filtering (query folding: YES if before custom steps) ---
    ActiveOnly = Table.SelectRows(Selected, each [Status] <> "Cancelled"),

    // --- Rename to snake_case ---
    Renamed = Table.RenameColumns(ActiveOnly, {
        {"OrderID",     "order_id"},
        {"CustomerID",  "customer_id"},
        {"OrderDate",   "order_date"},
        {"TotalAmount", "total_amount"},
        {"Status",      "status"}
    }),

    // --- Explicit typing (query folding: partially preserved) ---
    Typed = Table.TransformColumnTypes(Renamed, {
        {"order_id",    Int32.Type},
        {"customer_id", Int32.Type},
        {"order_date",  type date},
        {"total_amount", Currency.Type},
        {"status",      type text}
    }),

    // --- Null safety (query folding: NO — breaks folding) ---
    NullSafe = Table.TransformColumns(Typed, {
        {"status", each if _ = null then "unknown" else Text.Lower(_), type text}
    })
in
    NullSafe
```

**Syntax validator kontroluje:**
- `let ... in` štruktúra
- Správne typy (`Int32.Type`, `type date`, `Currency.Type`)
- `MissingField.Error` v `Table.SelectColumns`
- Každý step referencuje predchádzajúci step

---

### `bi:mdx` — MDX (Legacy OLAP) 📄

Generation only. MDX je pre legacy Analysis Services multidimenzionálne kocky.

```mdx
-- Top 10 zákazníkov podľa revenue v aktuálnom roku
SELECT
    NON EMPTY {
        [Measures].[Total Revenue],
        [Measures].[Order Count]
    } ON COLUMNS,
    NON EMPTY
        TOPCOUNT(
            [Customer].[Customer Name].Children,
            10,
            [Measures].[Total Revenue]
        )
    * [Date].[Calendar Year].&[2026] ON ROWS
FROM [Sales Cube]
WHERE ([Date].[Calendar Year].&[2026])
```

---

## Azure / Cloud Analytics

### `kql:adx` — KQL (Azure Data Explorer) ℹ️

Syntax validation: KQL grammar parser.

**Profesionálne vzory:**

```kql
// Staging funkcia — základná transformácia
.create-or-alter function
with (
    docstring = "Staging: Northwind orders. Grain: order_id.",
    folder    = "staging"
)
fn_stg_northwind_orders() {
    RawOrders
    | where isnotnull(OrderId) and TotalAmount > 0
    | project
        order_id     = OrderId,
        customer_id  = CustomerId,
        order_date   = todatetime(OrderDate),
        total_amount = toreal(TotalAmount),
        status       = tolower(Status),
        region       = coalesce(Region, "Unknown")
}

// Materialized view — denná agregácia
.create materialized-view with (backfill=true)
mv_fct_sales_daily on table RawOrders
{
    RawOrders
    | where isnotnull(OrderId) and TotalAmount > 0
    | summarize
        TotalRevenue      = sum(TotalAmount),
        OrderCount        = count(),
        DistinctCustomers = dcount(CustomerId),
        AvgOrderValue     = avg(TotalAmount)
        by
        OrderDay   = bin(todatetime(OrderDate), 1d),
        CustomerId = CustomerId,
        Region     = coalesce(Region, "Unknown")
}

// Analytická query — time series s render
mv_fct_sales_daily
| where OrderDay >= ago(90d)
| summarize WeeklyRevenue = sum(TotalRevenue) by Week = bin(OrderDay, 7d)
| order by Week asc
| render timechart with (title="Weekly Revenue - Last 90 Days")

// Pattern: medziročné porovnanie
let current = mv_fct_sales_daily
    | where OrderDay >= startofyear(now())
    | summarize Revenue = sum(TotalRevenue) by Month = bin(OrderDay, 30d);
let prior   = mv_fct_sales_daily
    | where OrderDay between (startofyear(ago(365d)) .. startofyear(now()))
    | summarize Revenue = sum(TotalRevenue) by Month = bin(OrderDay, 30d);
current
| join kind=leftouter prior on Month
| project
    Month,
    CurrentYearRevenue = Revenue,
    PriorYearRevenue   = Revenue1,
    YoYGrowthPct       = round(100.0 * (Revenue - Revenue1) / Revenue1, 1)
| order by Month asc
```

---

### `kql:sentinel` — KQL (Microsoft Sentinel) ℹ️

Rovnaký parser ako `kql:adx` + Sentinel-specific table validation (`SecurityEvent`, `Syslog`, `AzureActivity`...). Generuje security analytics queries.

```kql
// Sentinel: podozrivé login patterny (príklad pre UEBA)
SecurityEvent
| where EventID == 4624
| where TimeGenerated >= ago(24h)
| summarize
    LoginCount = count(),
    DistinctIPs = dcount(IpAddress),
    Locations   = make_set(MachineGroup)
    by Account
| where LoginCount > 10 and DistinctIPs > 3
| project Account, LoginCount, DistinctIPs, Locations
| order by LoginCount desc
```

---

## Iné jazyky

### `r:dplyr` — R / dplyr + tidyverse 📄

```r
library(dplyr)
library(lubridate)
library(DBI)
library(duckdb)

load_fct_sales <- function(
    con,
    start_date = NULL,
    end_date   = NULL,
    max_rows   = 1e5L
) {
    #' Sales fact table.
    #' @param con DBI connection
    #' @param start_date Optional filter: orders from this date (inclusive)
    #' @param end_date   Optional filter: orders before this date (exclusive)
    #' @return tibble with one row per order_id

    query <- tbl(con, "fct_sales") |>
        select(
            order_id, customer_id, product_id,
            order_date, total_amount, quantity
        )

    if (!is.null(start_date)) {
        query <- query |> filter(order_date >= as.Date(start_date))
    }
    if (!is.null(end_date)) {
        query <- query |> filter(order_date < as.Date(end_date))
    }

    query |>
        collect() |>
        mutate(
            order_id    = as.integer(order_id),
            customer_id = as.integer(customer_id),
            order_date  = ymd(order_date),
            total_amount = as.numeric(total_amount)
        ) |>
        head(max_rows)
}
```

---

### `r:datatable` — R / data.table 📄

```r
library(data.table)
library(DBI)

load_fct_sales <- function(con, start_date = NULL) {
    #' Sales fact table via data.table.
    #' Fast in-memory operations; no dplyr dependency.

    dt <- setDT(dbGetQuery(con, "SELECT * FROM fct_sales"))

    dt[, order_date := as.Date(order_date)]
    dt[, total_amount := as.numeric(total_amount)]

    if (!is.null(start_date)) {
        dt <- dt[order_date >= as.Date(start_date)]
    }

    setkey(dt, order_id)
    return(dt[])
}
```

---

### `scala:spark` — Scala / Apache Spark 📄

```scala
import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

object FctSalesTransform {

  /**
   * Sales fact table transformation.
   * Grain: order_id.
   * Repartitioned by order_date for Delta Lake optimization.
   */
  def transform(
      spark: SparkSession,
      df: DataFrame,
      startDate: Option[String] = None,
  ): DataFrame = {
    val schema = StructType(Seq(
      StructField("order_id",     IntegerType, nullable = false),
      StructField("customer_id",  IntegerType, nullable = false),
      StructField("order_date",   DateType,    nullable = false),
      StructField("total_amount", DecimalType(15, 2), nullable = false),
      StructField("quantity",     ShortType,   nullable = false),
    ))

    var result = df
      .select(
        col("order_id").cast(IntegerType),
        col("customer_id").cast(IntegerType),
        to_date(col("order_date")).alias("order_date"),
        col("total_amount").cast(DecimalType(15, 2)),
        col("quantity").cast(ShortType),
      )
      .filter(col("order_id").isNotNull)
      .dropDuplicates("order_id")

    startDate.foreach { d =>
      result = result.filter(col("order_date") >= lit(d).cast(DateType))
    }

    result.repartition(col("order_date"))
  }
}
```

---

### `julia:df` — Julia / DataFrames.jl 📄

```julia
using DataFrames, Dates, DBInterface, DuckDB

"""
    load_fct_sales(con; start_date=nothing, end_date=nothing)

Load sales fact table.
Grain: one row per order_id.
"""
function load_fct_sales(
    con::DuckDB.DB;
    start_date::Union{Date, Nothing} = nothing,
    end_date::Union{Date, Nothing}   = nothing,
)::DataFrame
    conditions = String["1=1"]
    isnothing(start_date) || push!(conditions, "order_date >= '$start_date'")
    isnothing(end_date)   || push!(conditions, "order_date < '$end_date'")

    sql = """
        SELECT
            order_id::INTEGER     AS order_id,
            customer_id::INTEGER  AS customer_id,
            order_date::DATE      AS order_date,
            total_amount::DECIMAL AS total_amount,
            quantity::SMALLINT    AS quantity
        FROM fct_sales
        WHERE $(join(conditions, " AND "))
    """

    return DBInterface.execute(con, sql) |> DataFrame
end
```

---

### `ts:prisma` — TypeScript / Prisma ORM 📄

```prisma
// schema.prisma — generated from AIBIo data model
// Grain: fct_sales has one row per order_id

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model DimCustomer {
  customerId   Int     @id @map("customer_id")
  customerName String  @map("customer_name") @db.VarChar(255)
  region       String? @map("region")       @db.VarChar(100)
  country      String  @map("country")      @db.VarChar(100)

  // PII fields — classified in AIBIo governance
  // email String? @map("email")
  // phone String? @map("phone")

  orders FctSales[]

  @@map("dim_customer")
}

model FctSales {
  orderId     Int      @id    @map("order_id")
  customerId  Int             @map("customer_id")
  orderDate   DateTime        @map("order_date") @db.Date
  totalAmount Decimal         @map("total_amount") @db.Decimal(15, 2)
  quantity    Int             @map("quantity")   @db.SmallInt

  customer DimCustomer @relation(fields: [customerId], references: [customerId])

  @@index([customerId])
  @@index([orderDate])
  @@map("fct_sales")
}
```

---

### `graphql:hasura` — GraphQL / Hasura 📄

```graphql
# Generated Hasura GraphQL queries and schema fragments
# Source: AIBIo workspace 'northwind_datamart'

# Relationship declaration (hasura metadata)
type fct_sales {
  order_id:     Int!
  customer_id:  Int!
  order_date:   date!
  total_amount: numeric!
  quantity:     smallint!

  # Relationship: fct_sales.customer_id → dim_customer.customer_id
  customer: dim_customer
}

# Query example: sales with customer details
query GetSalesWithCustomer($startDate: date!, $limit: Int = 100) {
  fct_sales(
    where: { order_date: { _gte: $startDate } }
    order_by: { order_date: desc }
    limit: $limit
  ) {
    order_id
    order_date
    total_amount
    quantity
    customer {
      customer_name
      country
      region
    }
  }
}

# Aggregation query
query GetRevenueByCountry($startDate: date!) {
  fct_sales_aggregate(
    where: { order_date: { _gte: $startDate } }
  ) {
    nodes {
      customer {
        country
      }
    }
    aggregate {
      sum { total_amount }
      count
    }
  }
}
```

---

## Rozšírenie registra

Pridanie nového jazyka si vyžaduje:

```typescript
// src/translate/registry/{lang-id}.ts
export const myNewLanguage: LanguageDefinition = {
  id:           'newlang:variant',
  displayName:  'New Language (Variant)',
  tier:         'gen-only',            // alebo full-exec / syntax-only / sandbox
  monacoLang:   'python',              // Monaco syntax highlighting ID
  fileExtension: '.nl',
  generator: {
    model:  'haiku',                   // alebo 'sonnet' pre komplexné
    systemPromptFile: 'newlang.md',    // v prompts/translate/
  },
  validator: null,                     // alebo implements SyntaxValidator
  executor:  null,                     // alebo implements CodeExecutor
}
```

Žiadna zmena v existujúcom kóde — registry je `Map<LanguageId, LanguageDefinition>`.
