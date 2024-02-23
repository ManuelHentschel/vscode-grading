
## E1
## 1
print(1)

##GC: ??/2.0pts

## 2
for(i in 2:20){
    print(i)
}

##GC: ??/2.0pts

## 3
f <- function(a, b){
    a + b
}

##GC: ??/2.0pts

## 4
f <- function(x){
    for(i in x:(2*x)){
        print(i)
    }
}

##GC: ??/3.0pts
