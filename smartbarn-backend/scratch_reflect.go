package main

import (
	"fmt"
	"reflect"
	"github.com/grafana/xk6-mqtt/mqtt"
)

func main() {
	t := reflect.TypeOf(mqtt.Client{})
	fmt.Println("Client Type:", t)
}
