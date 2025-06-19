import 'dart:math' as math;

abstract class Randomizer {
  /// Returns a random number between 0.0 and 1.0.
  double random();

  /// Returns the next pseudorandom, uniformly distributed int value.
  int nextInt();
}

class RandomizerImpl implements Randomizer {
  static final math.Random _random = math.Random();

  @override
  double random() {
    return _random.nextDouble();
  }

  @override
  int nextInt() {
    return _random.nextInt(1 << 32);
  }
}
