# dl-livepeer

This is a script that downloads builds of the latest version of `go-livepeer` using JavaScript.

### Usage

```
npx dl-livepeer
```

That'll drop `livepeer` and `livepeer_cli` executables in your current working directory. If you want to put them in a different directory to make them globally accessible, you can do something like

```
npx dl-livepeer -o /usr/local/bin
```

If you wanna download a version from a branch other than `master`, you can do

```
npx dl-livepeer -b branch-name
```

That's it!
