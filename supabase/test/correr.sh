#!/usr/bin/env bash
# Aplica schema.sql sobre un Postgres efimero y corre las pruebas de permisos.
#   supabase/test/correr.sh
set -euo pipefail
export PATH="$PATH:/usr/lib/postgresql/16/bin"
DIR=$(mktemp -d /tmp/enpunto-pg.XXXX)
trap 'pg_ctl -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
cp supabase/schema.sql supabase/test/arnes.sql supabase/test/permisos.sql "$DIR/"
initdb -D "$DIR/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DIR/data" -o "-k $DIR -c listen_addresses=" -l "$DIR/log" start >/dev/null
psql -h "$DIR" -U postgres -q -c 'create database enpunto' >/dev/null
run() { psql -h "$DIR" -U postgres -d enpunto -v ON_ERROR_STOP=1 "$@"; }
run -q -f "$DIR/arnes.sql"
run -q -f "$DIR/schema.sql" 2>&1 | grep -v 'does not exist, skipping' || true
# Grants del arnes: en Supabase el rol `authenticated` ya los tiene. Van
# despues del schema porque alcanzan a las tablas que este acaba de crear.
run -q -c 'grant all on all tables in schema public, storage to authenticated;' >/dev/null
run -q -c 'create schema pruebas; grant usage on schema pruebas to authenticated;' >/dev/null
run -f "$DIR/permisos.sql" 2>&1 | grep -E 'ok  |FALLO|ERROR' | sed 's/^psql:[^ ]* //;s/NOTICE:  //'
