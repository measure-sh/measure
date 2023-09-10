# measure
measure is an open source observability platform for mobile teams. 

Our first product is `Rewind`.

# Rewind (MVP) roadmap
## Android SDK
 - [ ] Kotlin/Java crashes
 - [ ] NDK crashes
 - [ ] ANRs

## iOS SDK
 - [ ] Swift crashes
 - [ ] Obj-C crashes
 - [ ] Native crashes
 - [ ] App Hangs

## Flutter SDK
### Crashes
 - [ ] Dart crashes
 - [ ] App Hangs

### Logs
 - [ ] Stdout logs
 - [ ] Custom logs

### Session replays
 - [ ] Crashes
 - [ ] Logs
 - [ ] Tap gesture
 - [ ] Scroll gesture
 - [ ] Drag gesture
 - [ ] Network requests
 - [ ] DB queries
 - [ ] Screenshots

## Web app
 - [ ] Landing page
 - [ ] Blog page
 - [ ] About us page
 - [ ] Docs (redirect to github)
 	- [ ] Android
 	- [ ] iOS
 	- [ ] Flutter
 	- [ ] API
 	- [ ] Self hosting (cover simple setup + using managed services for each major cloud)
 - [ ] Login/Signup
 - [ ] RBAC
 - [ ] SSO
 - [ ] Team management
 - [ ] App management
 - [ ] API key management
 - [ ] Billing + Metering page
 - [ ] Dashboard
 - [ ] Session replay viewer

## Backend
 - [ ] Login/Signup API
 - [ ] RBAC
 - [ ] SSO
 - [ ] Metering
 - [ ] Billing
 - [ ] Team management
 - [ ] App management
 - [ ] API key management
 - [ ] Events
 - [ ] Crashes
 - [ ] ANRs
 - [ ] Network calls
 - [ ] DB queries
 - [ ] Logs
 - [ ] Session replays
 - [ ] Auto data deletion after retention period
 - [ ] Self hosting - docker with clickhouse, postgres, golang server + instructions to get API key of managed services and plug them in

## Stack
- Supabase for Postgres
- Fly.io for golang server deployments
- Clickhouse for analytics
- Resend for email
- S3 for storage
- Supabase/Clerk for auth (TBD)
- Managed provider for logging (TBD)
- Managed provider for log search (TBD)
- Android only for MVP (TBD)









