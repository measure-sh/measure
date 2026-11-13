#include "CppException.h"

#include <stdexcept>

void frank_throw_cpp_exception(void) {
    throw std::runtime_error("Sample C++ exception from Frankenstein");
}
