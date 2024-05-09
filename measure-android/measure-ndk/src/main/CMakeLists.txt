cmake_minimum_required(VERSION 3.4.1)

add_library(measure-ndk SHARED
        cpp/measure.cpp
        cpp/anr_handler.c
)

target_link_libraries(measure-ndk
        android
        log)
