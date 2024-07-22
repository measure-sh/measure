FROM public.ecr.aws/docker/library/gradle:8-jdk17 AS build
COPY --chown=gradle:gradle . /home/gradle/src
WORKDIR /home/gradle/src
RUN --mount=type=cache,target=/root/.gradle gradle buildFatJar --no-daemon

FROM public.ecr.aws/docker/library/eclipse-temurin:17
EXPOSE 8181:8181
RUN mkdir /app
COPY --from=build /home/gradle/src/build/libs/*.jar /app/app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]
