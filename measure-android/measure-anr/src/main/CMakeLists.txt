cmake_minimum_required(VERSION 3.4.1)

add_library(measure-anr SHARED
        cpp/measure.cpp
)

target_link_libraries(measure-anr
        android
        log)
