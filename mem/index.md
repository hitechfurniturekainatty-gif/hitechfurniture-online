# Project Memory

## Core
Admin app is used by Admin + Staff (multiple roles) simultaneously. Every change must keep the app fast and responsive under concurrent multi-user load — no full-table scans, no blocking UI, prefer indexed queries and React Query caching (staleTime ≥ 60s).

## Memories
(none yet)