.PHONY: all test check build publish

all: check

build:
	bun test

test:
	bun test

check: test

publish: check
	npm publish --access public
