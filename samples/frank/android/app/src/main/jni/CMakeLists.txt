cmake_minimum_required(VERSION 3.22.1)
project(appmodules)

# Preserve React Native's generated application library and autolinking.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

add_library(frank_memory SHARED native_memory.c)
target_compile_options(frank_memory PRIVATE -Wall -Wextra -Werror)

add_library(frank_crash SHARED native_crash.c)
target_compile_options(frank_crash PRIVATE -Wall -Wextra -Werror)
target_link_libraries(frank_crash log)
