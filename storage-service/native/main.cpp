#include <dirent.h>
#include <string>
#include <sys/stat.h>
#include <iostream>
#include <pwd.h>
#include <sys/acl.h>
#include <vector>
#include <grp.h>
#include <sys/xattr.h>
#include <cassert>

#ifdef __linux__
#include <acl/libacl.h>
#include <string.h>
#define GETXATTR(path, name, value, size) getxattr(path, name, value, size)
#endif

#ifdef __APPLE__

#include "libacl.h"

#define GETXATTR(path, name, value, size) getxattr(path, name, value, size, 0, 0)

int acl_get_perm(acl_permset_t perm, int value) {
    return 0;
}

#endif

static int one(const struct dirent *unused) {
    return 1;
}

#define fatal(f) { fprintf(stderr, "Fatal error! errno %d. Cause: %s", errno, f); exit(1); }

typedef struct {
    char *name;
    uint8_t mode;
} shared_with_t;

#define SHARED_WITH_UTYPE 1
#define SHARED_WITH_READ 2
#define SHARED_WITH_WRITE 4
#define SHARED_WITH_EXECUTE 8

int main() {
    struct dirent **entries;
    struct stat stat_buffer{};
    acl_type_t acl_type = ACL_TYPE_ACCESS;
    acl_entry_t entry{};
    acl_tag_t acl_tag;
    acl_permset_t permset;
    char sensitivity_buffer[32];

    auto num_entries = scandir("./", &entries, one, alphasort);
    for (int i = 0; i < num_entries; i++) {
        auto ep = entries[i];
        std::string file_type;
        if (ep->d_type == DT_DIR) {
            file_type = "D";
        } else if (ep->d_type == DT_REG) {
            file_type = "F";
        } else if (ep->d_type == DT_LNK) {
            file_type = "L";
        }

        stat(ep->d_name, &stat_buffer);

        auto uid = stat_buffer.st_uid;
        auto gid = stat_buffer.st_gid;

        auto unix_mode = (stat_buffer.st_mode & (S_IRWXU | S_IRWXG | S_IRWXO));

        auto user = getpwuid(uid);
        if (user == nullptr) fatal("Could not find user");

        char *group_name;
        auto gr = getgrgid(gid);
        if (gr == nullptr) group_name = const_cast<char *>("nobody");
        else group_name = gr->gr_name;

        if (strcmp(".", ep->d_name) == 0) continue;
        if (strcmp("..", ep->d_name) == 0) continue;

        std::cout << file_type << ',' << unix_mode << ',' << user->pw_name << ',' << group_name << ','
                  << stat_buffer.st_size << ',' << stat_buffer.st_ctime << ','
                  << stat_buffer.st_mtime << ',' << stat_buffer.st_atime << ',';

        errno = 0;
        auto acl = acl_get_file(ep->d_name, acl_type);

#ifdef __linux__
        if (acl == nullptr && errno != ENOTSUP) fatal("acl_get_file");
#endif

        std::vector<shared_with_t> shares;
        int entry_count = 0;

        if (acl != nullptr) {
            for (int entry_idx = ACL_FIRST_ENTRY;; entry_idx = ACL_NEXT_ENTRY) {
                if (acl_get_entry(acl, entry_idx, &entry) != 1) {
                    break;
                }

                if (acl_get_tag_type(entry, &acl_tag) == -1) fatal("acl_get_tag_type");
                auto qualifier = acl_get_qualifier(entry);
                bool retrieve_permissions = false;
                bool is_user = false;
                char *share_name = nullptr;

                if (acl_tag == ACL_USER) {
                    is_user = true;

                    auto acl_uid = (uid_t *) qualifier;
                    passwd *pPasswd = getpwuid(*acl_uid);
                    if (pPasswd == nullptr) fatal("acl uid");

                    share_name = pPasswd->pw_name;

                    retrieve_permissions = true;
                } else if (acl_tag == ACL_GROUP) {
                    auto acl_uid = (gid_t *) qualifier;
                    group *pGroup = getgrgid(*acl_uid);
                    if (pGroup == nullptr) fatal("acl gid");

                    share_name = pGroup->gr_name;

                    retrieve_permissions = true;
                }

                if (retrieve_permissions) {
                    if (acl_get_permset(entry, &permset) == -1) fatal("permset");
                    bool has_read = acl_get_perm(permset, ACL_READ) == 1;
                    bool has_write = acl_get_perm(permset, ACL_WRITE) == 1;
                    bool has_execute = acl_get_perm(permset, ACL_EXECUTE) == 1;

                    uint8_t mode = 0;
                    if (!is_user) mode |= SHARED_WITH_UTYPE;
                    if (has_read) mode |= SHARED_WITH_READ;
                    if (has_write) mode |= SHARED_WITH_WRITE;
                    if (has_execute) mode |= SHARED_WITH_EXECUTE;

                    shared_with_t shared{};
                    assert(share_name != nullptr);

                    auto dest = (char * )malloc(strlen(share_name));
                    strcpy(dest, share_name);

                    shared.name = dest;
                    shared.mode = mode;

                    shares.emplace_back(shared);
                    entry_count++;
                }

                acl_free(qualifier);
            }
        }

        std::cout << entry_count << ',';

        for (const auto &e : shares) {
            std::cout << e.name << ',' << (int) e.mode << ',';
        }

        memset(&sensitivity_buffer, 0, 32);
        GETXATTR(ep->d_name, "user.sensitivity", &sensitivity_buffer, 32);

        char *sensitivity_result = sensitivity_buffer;
        if (strlen(sensitivity_buffer) == 0) {
            sensitivity_result = const_cast<char *>("CONFIDENTIAL");
        }

        std::cout << sensitivity_result << ',' << ep->d_name << std::endl;
    }
    return 0;
}