#!/usr/bin/env bash
# Verifica que schema.sql y las migraciones digan lo mismo.
#
# `schema.sql` crea una base desde cero; las migraciones actualizan una que ya
# existe. Son dos caminos al mismo destino y nada los comparaba: la historia
# 1.5 escribio una funcion, una vista y una policy solo en `schema.sql`, las 80
# aserciones pasaron en verde, y en la base desplegada no existia nada de eso.
#
# Construye dos bases —una con schema.sql de HEAD, otra con schema.sql de la
# base mas las migraciones agregadas desde entonces— y compara el inventario de
# objetos: tablas, columnas, policies, funciones y vistas.
#
#   supabase/test/deriva.sh [ref-base]
set -euo pipefail
export PATH="$PATH:/usr/lib/postgresql/16/bin"

# El commit desde el que se cuentan las migraciones: el ultimo en el que
# schema.sql y las migraciones ya estaban de acuerdo. Se mueve cuando una
# migracion vieja se pliega al schema.
BASE="${1:-f913e2e}"

if [ "$(id -u)" = 0 ] && [ -z "${ENPUNTO_YA_DEGRADADO:-}" ] && getent passwd postgres >/dev/null; then
  DIR=$(mktemp -d /tmp/enpunto-deriva.XXXX)
  cp -r . "$DIR/repo"
  chown -R postgres:postgres "$DIR"
  trap 'rm -rf "$DIR"' EXIT
  exec su postgres -c "cd '$DIR/repo' && ENPUNTO_YA_DEGRADADO=1 bash supabase/test/deriva.sh $BASE"
fi

DIR=$(mktemp -d /tmp/enpunto-deriva.XXXX)
trap 'pg_ctl -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

git show "$BASE:supabase/schema.sql" > "$DIR/schema-base.sql"
git show "$BASE:supabase/migraciones" 2>/dev/null | tail -n +3 > "$DIR/migraciones-base.txt" || true
# Las migraciones agregadas despues de la base, en orden.
NUEVAS=$(for f in supabase/migraciones/*.sql; do
  grep -qxF "$(basename "$f")" "$DIR/migraciones-base.txt" || echo "$f"
done | sort)
echo "Base: $BASE"
echo "Migraciones desde entonces:"; echo "$NUEVAS" | sed 's/^/  /'

initdb -D "$DIR/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DIR/data" -o "-k $DIR -c listen_addresses=" -l "$DIR/log" start >/dev/null
psql -h "$DIR" -U postgres -q -c 'create database desde_schema' >/dev/null
psql -h "$DIR" -U postgres -q -c 'create database desde_migraciones' >/dev/null
ap() { psql -h "$DIR" -U postgres -d "$1" -v ON_ERROR_STOP=1 -q -f "$2" 2>&1 | grep -E "ERROR" || true; }

ap desde_schema supabase/test/arnes.sql
ap desde_schema supabase/schema.sql

ap desde_migraciones supabase/test/arnes.sql
ap desde_migraciones "$DIR/schema-base.sql"
for m in $NUEVAS; do ap desde_migraciones "$m"; done

# El inventario: que existe y con que forma. No compara cuerpos de funcion
# —el formato varia— sino nombres, columnas y policies, que es donde estuvo
# la deriva real.
INVENTARIO="
select 'tabla   ' || table_name || '.' || column_name || ' ' || data_type
  from information_schema.columns where table_schema = 'public'
union all
select 'policy  ' || tablename || ' ' || policyname from pg_policies where schemaname = 'public'
union all
select 'funcion ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all
select 'vista   ' || table_name from information_schema.views where table_schema = 'public'
order by 1"
for db in desde_schema desde_migraciones; do
  psql -h "$DIR" -U postgres -d "$db" -Atq -c "$INVENTARIO" > "$DIR/$db.txt"
done

echo "---"
if diff -u "$DIR/desde_schema.txt" "$DIR/desde_migraciones.txt" \
     --label "desde schema.sql" --label "desde las migraciones"; then
  echo "Sin deriva: los dos caminos dan el mismo esquema."
else
  echo ""
  echo "DERIVA: lo que dice schema.sql y lo que dicen las migraciones no coincide."
  echo "  '-' esta solo en schema.sql (falta la migracion)"
  echo "  '+' esta solo en las migraciones (falta plegarlo al schema)"
  exit 1
fi
