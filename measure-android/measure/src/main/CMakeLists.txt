cmake_minimum_required(VERSION 3.4.1)

add_library(measure-ndk SHARED
        jni/measure.cpp
        jni/anr_handler.c
        jni/jni_utils.c
)

target_link_libraries(measure-ndk
        android
        log)

set_target_properties(measure-ndk
        PROPERTIES
        COMPILE_OPTIONS
        -Werror -Wall -pedantic)