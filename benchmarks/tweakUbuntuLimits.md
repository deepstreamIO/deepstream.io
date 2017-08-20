Add this to `/etc/security/limits.conf`:

```
* soft nofile 2000000
* hard nofile 2000000
```

And this to `/etc/sysctl.conf`:

```
fs.file-max = 2000000
```

Then run `sudo sysctl -p`

