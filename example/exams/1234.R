
## E1
## 1
print(1)

##GC: 2.0/2.0pts ()

## 2
print(2)
print(20)


##GC: 2.0/2.0pts ()

## 3
f <- function(a){
    a + a
}

##GC: 0.0/2.0pts

## 4
f <- function(x){
    print(x + 2*x)
}

##GC: 2.0/3.0pts

## E2
## 1
print(runif(1))

## 3
print(sum(runif(2)))

