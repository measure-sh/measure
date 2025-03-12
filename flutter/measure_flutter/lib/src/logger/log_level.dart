enum LogLevel {
  debug(500),
  info(800),
  warning(900),
  error(1000),
  fatal(2000);

  const LogLevel(this.level);

  final int level;
}
