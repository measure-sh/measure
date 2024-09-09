cmake_minimum_required(VERSION 3.4.1)

add_library(measure-ndk SHARED
        jni/measure.cpp
        jni/anr_handler.c
        jni/jni_utils.c
)

target_link_libraries(measure-ndk
        android
        log)

target_link_options(measure-ndk PRIVATE "-Wl,-z,max-page-size=16384")

set_target_properties(measure-ndk
        PROPERTIES
        COMPILE_OPTIONS
        -Werror -Wall -pedantic)